//
//  ContentView.swift
//  StudyMathMac
//
//  主视图 - 三栏布局
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var errorViewModel: ErrorViewModel
    @EnvironmentObject var methodologyViewModel: MethodologyViewModel
    
    @State private var selectedTab: SidebarItem = .allErrors
    @State private var columnVisibility = NavigationSplitViewVisibility.all
    
    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // 左侧边栏
            SidebarView(selectedTab: $selectedTab)
                .navigationSplitViewColumnWidth(min: 200, ideal: 220, max: 300)
        } content: {
            // 中间列表
            ErrorListView(selectedTab: $selectedTab)
                .navigationSplitViewColumnWidth(min: 300, ideal: 400, max: 600)
        } detail: {
            // 右侧详情
            if let selectedError = errorViewModel.selectedError {
                ErrorDetailView(error: selectedError)
            } else {
                EmptyDetailView()
            }
        }
        .navigationTitle("高中数学错题本")
        .toolbar {
            ToolbarItemGroup(placement: .navigation) {
                Button {
                    withAnimation {
                        columnVisibility = columnVisibility == .all ? .detailOnly : .all
                    }
                } label: {
                    Image(systemName: "sidebar.leading")
                }
            }
            
            ToolbarItemGroup(placement: .primaryAction) {
                // 搜索框
                TextField("搜索错题", text: $errorViewModel.searchText)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 200)
                
                Divider()
                
                // 筛选菜单
                Menu {
                    Picker("难度等级", selection: $errorViewModel.filterDifficulty) {
                        Text("全部").tag(DifficultyLevel.all)
                        Text("基础").tag(DifficultyLevel.basic)
                        Text("中等").tag(DifficultyLevel.medium)
                        Text("难题").tag(DifficultyLevel.hard)
                    }
                    
                    Divider()
                    
                    Picker("掌握程度", selection: $errorViewModel.filterMastery) {
                        Text("全部").tag(MasteryLevel.all)
                        Text("未掌握").tag(MasteryLevel.notMastered)
                        Text("基本掌握").tag(MasteryLevel.basicMastery)
                        Text("已掌握").tag(MasteryLevel.mastered)
                    }
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                }
                .help("筛选条件")
                
                // 添加按钮
                Button {
                    errorViewModel.showAddSheet = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                }
                .help("新增错题 (⌘N)")
            }
        }
        .sheet(isPresented: $errorViewModel.showAddSheet) {
            ErrorEditView(mode: .add)
        }
        .sheet(isPresented: $methodologyViewModel.showMethodologyList) {
            MethodologyListView()
        }
    }
}

// 空详情页
struct EmptyDetailView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            Text("选择一条错题查看详情")
                .font(.title2)
                .foregroundColor(.secondary)
            
            Text("或点击右上角 + 按钮新增错题")
                .font(.body)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .textBackgroundColor))
    }
}

#Preview {
    ContentView()
        .environmentObject(ErrorViewModel())
        .environmentObject(MethodologyViewModel())
        .frame(width: 1200, height: 800)
}
