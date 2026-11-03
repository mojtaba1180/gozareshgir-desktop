use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    ActivationPolicy, AppHandle, Manager,
};
use tauri_plugin_shell::ShellExt;

#[cfg(target_os = "macos")]
fn configure_macos_notch_window(window: &tauri::WebviewWindow) {
    use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
    if let Ok(ns_win_ptr) = window.ns_window() {
        let ns_window = unsafe { &*(ns_win_ptr as *mut NSWindow) };
        // Level 1000 is NSScreenSaverWindowLevel.
        // This ensures the notch window floats above macOS Full-Screen apps and all virtual spaces.
        ns_window.setLevel(1000);
        ns_window.setCollectionBehavior(
            NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::FullScreenAuxiliary
                | NSWindowCollectionBehavior::Stationary
                | NSWindowCollectionBehavior::IgnoresCycle,
        );
        ns_window.orderFrontRegardless();
    }
}

fn configure_notch_window_on_monitor(
    window: &tauri::WebviewWindow,
    monitor: &tauri::Monitor,
    position: &str,
    width: f64,
    height: f64,
) {
    let scale_factor = monitor.scale_factor();
    let screen_width = monitor.size().width as f64 / scale_factor;
    let screen_height = monitor.size().height as f64 / scale_factor;
    let monitor_x = monitor.position().x as f64 / scale_factor;
    let monitor_y = monitor.position().y as f64 / scale_factor;

    let margin = 16.0;
    let (new_x, new_y) = match position {
        "top-left" => (monitor_x + margin, monitor_y + margin),
        "top-right" => (monitor_x + screen_width - width - margin, monitor_y + margin),
        "bottom-center" => (
            monitor_x + (screen_width - width) / 2.0,
            monitor_y + screen_height - height - margin,
        ),
        "bottom-left" => (monitor_x + margin, monitor_y + screen_height - height - margin),
        "bottom-right" => (
            monitor_x + screen_width - width - margin,
            monitor_y + screen_height - height - margin,
        ),
        _ => (monitor_x + (screen_width - width) / 2.0, monitor_y), // default "top-center" (notch)
    };

    let _ = window.set_size(tauri::LogicalSize::new(width, height));
    let _ = window.set_position(tauri::LogicalPosition::new(new_x, new_y));
    #[cfg(target_os = "macos")]
    configure_macos_notch_window(window);
}

#[tauri::command]
fn set_notch_position(app: AppHandle, position: String, width: f64, height: f64) {
    if let Ok(monitors) = app.available_monitors() {
        for (idx, monitor) in monitors.iter().enumerate() {
            let label = if idx == 0 {
                "notch".to_string()
            } else {
                format!("notch-{}", idx)
            };

            if let Some(window) = app.get_webview_window(&label) {
                configure_notch_window_on_monitor(&window, monitor, &position, width, height);
            } else {
                let builder = tauri::WebviewWindowBuilder::new(
                    &app,
                    &label,
                    tauri::WebviewUrl::App("index.html?view=notch".into()),
                )
                .title("Notch")
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .shadow(false);

                if let Ok(new_win) = builder.build() {
                    let _ = new_win.show();
                    configure_notch_window_on_monitor(&new_win, monitor, &position, width, height);
                }
            }
        }
    }
}

#[tauri::command]
fn resize_notch(app: AppHandle, width: f64, height: f64, position: Option<String>, label: Option<String>) {
    let pos = position.unwrap_or_else(|| "top-center".to_string());
    let target_label = label.unwrap_or_else(|| "notch".to_string());

    if let Some(window) = app.get_webview_window(&target_label) {
        if let Ok(Some(monitor)) = window.current_monitor() {
            configure_notch_window_on_monitor(&window, &monitor, &pos, width, height);
        }
    }
}

#[tauri::command]
fn open_url(app: AppHandle, url: String) {
    let _ = app.shell().open(url, None);
}

#[tauri::command]
fn update_tray_status(app: AppHandle, title: Option<String>, tooltip: Option<String>) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        if let Some(t) = title {
            let _ = tray.set_title(Some(t));
        }
        if let Some(tt) = tooltip {
            let _ = tray.set_tooltip(Some(tt));
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct MonitorInfo {
    id: String,
    name: String,
    width: u32,
    height: u32,
    is_primary: bool,
}

#[tauri::command]
fn get_available_monitors(app: AppHandle) -> Vec<MonitorInfo> {
    let mut list = Vec::new();
    if let Ok(monitors) = app.available_monitors() {
        for (idx, monitor) in monitors.iter().enumerate() {
            let name = monitor.name().map(|n| n.to_string()).unwrap_or_else(|| {
                if idx == 0 {
                    "نمایشگر مک‌بوک (Built-in Retina)".to_string()
                } else {
                    format!("مانیتور جانبی {}", idx + 1)
                }
            });
            list.push(MonitorInfo {
                id: idx.to_string(),
                name,
                width: monitor.size().width,
                height: monitor.size().height,
                is_primary: idx == 0,
            });
        }
    }
    list
}

#[tauri::command]
fn set_notch_target_display(app: AppHandle, target: String) {
    if let Ok(monitors) = app.available_monitors() {
        for (idx, _) in monitors.iter().enumerate() {
            let label = if idx == 0 {
                "notch".to_string()
            } else {
                format!("notch-{}", idx)
            };

            if let Some(win) = app.get_webview_window(&label) {
                let should_show = match target.as_str() {
                    "all" => true,
                    "main" => idx == 0,
                    id => id == idx.to_string(),
                };

                if should_show {
                    let _ = win.show();
                    #[cfg(target_os = "macos")]
                    configure_macos_notch_window(&win);
                } else {
                    let _ = win.hide();
                }
            }
        }
    }
}

#[tauri::command]
fn toggle_main_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
fn toggle_notch_visibility(app: AppHandle) {
    if let Some(window) = app.get_webview_window("notch") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            #[cfg(target_os = "macos")]
            configure_macos_notch_window(&window);
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
fn open_devtools(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            resize_notch,
            set_notch_position,
            open_url,
            update_tray_status,
            toggle_main_window,
            toggle_notch_visibility,
            open_devtools,
            get_available_monitors,
            set_notch_target_display
        ])
        .setup(|app| {
            // Configure tray menu
            let quit_i = MenuItem::with_id(app, "quit", "خروج از گزارش‌گیر", true, None::<&str>)?;
            let toggle_main_i = MenuItem::with_id(app, "toggle_main", "نمایش / مخفی کردن میز کار", true, None::<&str>)?;
            let toggle_notch_i = MenuItem::with_id(app, "toggle_notch", "نمایش / مخفی کردن ناچ", true, None::<&str>)?;
            let devtools_i = MenuItem::with_id(app, "devtools", "باز کردن کنسول دیباگ (DevTools)", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_main_i, &toggle_notch_i, &devtools_i, &quit_i])?;

            if let Some(icon) = app.default_window_icon() {
                let _ = TrayIconBuilder::with_id("main-tray")
                    .icon(icon.clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "toggle_main" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "toggle_notch" => {
                            if let Ok(monitors) = app.available_monitors() {
                                for idx in 0..monitors.len() {
                                    let label = if idx == 0 {
                                        "notch".to_string()
                                    } else {
                                        format!("notch-{}", idx)
                                    };
                                    if let Some(window) = app.get_webview_window(&label) {
                                        if window.is_visible().unwrap_or(false) {
                                            let _ = window.hide();
                                        } else {
                                            let _ = window.show();
                                            #[cfg(target_os = "macos")]
                                            configure_macos_notch_window(&window);
                                            let _ = window.set_focus();
                                        }
                                    }
                                }
                            }
                        }
                        "devtools" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.open_devtools();
                            }
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;
            }

            // Set activation policy to Accessory on macOS so the notch window is allowed
            // to float above other applications in macOS Full-Screen spaces.
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(ActivationPolicy::Accessory);
            }

            // Setup Notch windows on ALL connected monitors (e.g. MacBook Display + External Monitors)
            if let Ok(monitors) = app.available_monitors() {
                let initial_width = 540.0;
                let initial_height = 38.0;

                for (idx, monitor) in monitors.iter().enumerate() {
                    let label = if idx == 0 {
                        "notch".to_string()
                    } else {
                        format!("notch-{}", idx)
                    };

                    if let Some(notch_win) = app.get_webview_window(&label) {
                        let _ = notch_win.set_always_on_top(true);
                        configure_notch_window_on_monitor(
                            &notch_win,
                            monitor,
                            "top-center",
                            initial_width,
                            initial_height,
                        );
                    } else {
                        let builder = tauri::WebviewWindowBuilder::new(
                            app,
                            &label,
                            tauri::WebviewUrl::App("index.html?view=notch".into()),
                        )
                        .title("Notch")
                        .decorations(false)
                        .transparent(true)
                        .always_on_top(true)
                        .skip_taskbar(true)
                        .shadow(false);

                        if let Ok(new_win) = builder.build() {
                            let _ = new_win.show();
                            configure_notch_window_on_monitor(
                                &new_win,
                                monitor,
                                "top-center",
                                initial_width,
                                initial_height,
                            );
                        }
                    }
                }
            }

            // Main window is initially visible
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.show();
                let _ = main_win.set_focus();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running gozareshgir desktop application");
}
