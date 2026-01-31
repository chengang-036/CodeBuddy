//
//  StudyMathMacApp.swift
//  StudyMathMac
//
//  Created on 2026/01/30.
//  高中数学错题本 - Mac应用
//

import SwiftUI

@main
struct StudyMathMacApp: App {
    // 持久化控制器
    let persistenceController = PersistenceController.shared
    
    // 应用状态
    @StateObject private var errorViewModel = ErrorViewModel()
    @StateObject private var methodologyViewModel = MethodologyViewModel()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
                .environmentObject(errorViewModel)
                .environmentObject(methodologyViewModel)
                .frame(minWidth: 1000, minHeight: 700)
        }
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unified)
        .commands {
            // 文件菜单
            CommandGroup(replacing: .newItem) {
                Button("新增错题") {
                    errorViewModel.showAddSheet = true
                }
                .keyboardShortcut("n", modifiers: .command)
                
                Divider()
                
                Button("导入数据...") {
                    errorViewModel.showImportPanel = true
                }
                .keyboardShortcut("o", modifiers: .command)
                
                Button("导出数据...") {
                    errorViewModel.showExportPanel = true
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])
            }
            
            // 编辑菜单
            CommandGroup(after: .pasteboard) {
                Button("粘贴图片") {
                    errorViewModel.pasteImage()
                }
                .keyboardShortcut("v", modifiers: [.command, .shift])
            }
            
            // 方法论菜单
            CommandMenu("方法论") {
                Button("新增方法论") {
                    methodologyViewModel.showAddSheet = true
                }
                .keyboardShortcut("m", modifiers: .command)
                
                Button("查看所有方法论") {
                    methodologyViewModel.showMethodologyList = true
                }
                .keyboardShortcut("l", modifiers: [.command, .shift])
            }
            
            // 视图菜单
            CommandMenu("视图") {
                Button("显示/隐藏侧边栏") {
                    errorViewModel.toggleSidebar()
                }
                .keyboardShortcut("s", modifiers: [.command, .control])
                
                Divider()
                
                Button("刷新列表") {
                    errorViewModel.refreshList()
                }
                .keyboardShortcut("r", modifiers: .command)
            }
        }
        
        // 设置窗口
        Settings {
            SettingsView()
        }
    }
}
