// =============================================================================
// dbv-md-reader — Claves de API en el almacén del sistema (RNF-IA.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RNF-IA.4
//
// La clave de una conexión se guarda en el Administrador de credenciales de
// Windows, el Llavero de macOS o el Secret Service de Linux (crate `keyring`),
// con el servicio `dbv-md-reader` y la conexión como cuenta. Nunca toca un
// fichero de la aplicación, el proyecto ni el frontend.
//
// Si el sistema no tiene almacén (un Linux sin Secret Service), la clave se
// recuerda solo en memoria durante la sesión, y se avisa.

use std::collections::HashMap;
use std::sync::Mutex;

use super::AiError;

const SERVICE: &str = "dbv-md-reader";

/// Dónde quedó guardada una clave.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum KeyStorage {
    System,
    Session,
}

/// Almacén de claves con respaldo en memoria.
#[derive(Default)]
pub struct Secrets {
    session: Mutex<HashMap<String, String>>,
}

fn lock(map: &Mutex<HashMap<String, String>>) -> std::sync::MutexGuard<'_, HashMap<String, String>> {
    map.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl Secrets {
    pub fn set(&self, connection_id: &str, key: &str) -> KeyStorage {
        let stored = keyring::Entry::new(SERVICE, connection_id).and_then(|entry| entry.set_password(key)).is_ok();
        if stored {
            lock(&self.session).remove(connection_id);
            KeyStorage::System
        } else {
            lock(&self.session).insert(connection_id.to_string(), key.to_string());
            KeyStorage::Session
        }
    }

    pub fn get(&self, connection_id: &str) -> Option<String> {
        lock(&self.session)
            .get(connection_id)
            .cloned()
            .or_else(|| keyring::Entry::new(SERVICE, connection_id).and_then(|entry| entry.get_password()).ok())
    }

    pub fn delete(&self, connection_id: &str) -> Result<(), AiError> {
        lock(&self.session).remove(connection_id);
        let result = keyring::Entry::new(SERVICE, connection_id).and_then(|entry| entry.delete_credential());
        delete_outcome(result, || in_system_store(connection_id))
    }
}

/// Qué hacer con el resultado de borrar la clave del almacén del sistema.
///
/// Sin almacén del sistema (Linux sin Secret Service) no hay clave que borrar allí:
/// solo es un error si la clave sigue en él tras fallar el borrado. Antes fallaba
/// siempre, y en esas máquinas no se podía eliminar ninguna conexión.
fn delete_outcome(result: Result<(), keyring::Error>, still_stored: impl FnOnce() -> bool) -> Result<(), AiError> {
    match result {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) if still_stored() => Err(AiError::SecretStore(error.to_string())),
        Err(_) => Ok(()),
    }
}

/// ¿Sigue la clave de esta conexión en el almacén del sistema?
fn in_system_store(connection_id: &str) -> bool {
    keyring::Entry::new(SERVICE, connection_id).and_then(|entry| entry.get_password()).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guardar_leer_y_borrar_una_clave() {
        // Con almacén del sistema (Windows, macOS) va a él; sin él (CI de
        // Linux sin Secret Service), a la sesión. En los dos casos se lee igual.
        let secrets = Secrets::default();
        let id = format!("test-{}", std::process::id());
        let storage = secrets.set(&id, "sk-prueba");
        assert!(matches!(storage, KeyStorage::System | KeyStorage::Session));
        assert_eq!(secrets.get(&id).as_deref(), Some("sk-prueba"));
        secrets.delete(&id).unwrap();
        assert_eq!(secrets.get(&id), None);
    }

    #[test]
    fn borrar_sin_almacen_del_sistema_no_es_un_error() {
        // Regresión (CI de Linux, v0.13.0): sin Secret Service, borrar fallaba y no se
        // podía eliminar ninguna conexión, tuviera o no clave.
        assert!(delete_outcome(Err(keyring::Error::NoDefaultStore), || false).is_ok());
    }

    #[test]
    fn borrar_una_clave_que_no_existe_es_correcto() {
        assert!(delete_outcome(Err(keyring::Error::NoEntry), || panic!("no debe consultarse")).is_ok());
        assert!(delete_outcome(Ok(()), || panic!("no debe consultarse")).is_ok());
    }

    #[test]
    fn borrar_falla_si_la_clave_sigue_en_el_almacen() {
        // Almacén accesible pero el borrado falló: la clave seguiría allí, y eso sí se avisa.
        assert!(matches!(delete_outcome(Err(keyring::Error::NoDefaultStore), || true), Err(AiError::SecretStore(_))));
    }
}
