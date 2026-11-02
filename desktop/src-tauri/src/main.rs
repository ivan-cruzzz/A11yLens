// Предотвращает появление консольного окна в release-сборке Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    a11ylens_desktop::run()
}
