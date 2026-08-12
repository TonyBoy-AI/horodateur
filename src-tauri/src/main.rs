// Empêche une console Windows en plus de la fenêtre app
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_sql::{Migration, MigrationKind};

fn main() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "creation_schema_initial",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_telephone_personne_reference",
            sql: include_str!("../migrations/002_add_client_fields.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "parametres_entreprise",
            sql: include_str!("../migrations/003_parametres_entreprise.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:horodateur.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application Horodateur");
}
