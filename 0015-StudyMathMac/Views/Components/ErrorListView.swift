//
//  ErrorListView.swift
//  StudyMathMac
//
//  错题列表视图
//

import SwiftUI

struct ErrorListView: View {
    @Binding var selectedTab: SidebarItem
    @EnvironmentObject var errorViewModel: ErrorViewModel
    
    var body: some View {
        List(errorViewModel.errors, id: \.id, selection: $errorViewModel.selectedError) { error in
            ErrorRowView(error: error)
                .tag(error)
                .contextMenu {
                    Button("编辑") {
                        errorViewModel.selectedError = error
                        errorViewModel.showEditSheet = true
                    }
                    
                    Divider()
                    
                    Button("删除", role: .destructive) {
                        errorViewModel.deleteError(error)
                    }
                }
        }
        .listStyle(.inset)
        .navigationTitle(selectedTab.rawValue)
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button {
                    errorViewModel.refreshList()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .help("刷新列表")
            }
        }
        .sheet(isPresented: $errorViewModel.showEditSheet) {
            if let error = errorViewModel.selectedError {
                ErrorEditView(mode: .edit(error))
            }
        }
    }
}

struct ErrorRowView: View {
    let error: ErrorRecord
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 标题行
            HStack {
                Text(error.chapter)
                    .font(.headline)
                
                Spacer()
                
                // 难度标签
                Text(error.difficulty)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(difficultyColor.opacity(0.2))
                    .foregroundColor(difficultyColor)
                    .cornerRadius(4)
            }
            
            // 题目描述
            if !error.questionDescription.isEmpty {
                Text(error.questionDescription)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            // 底部信息
            HStack {
                // 掌握程度
                HStack(spacing: 4) {
                    Image(systemName: masteryIcon)
                        .font(.caption2)
                    Text(error.mastery)
                        .font(.caption2)
                }
                .foregroundColor(masteryColor)
                
                Spacer()
                
                // 日期
                Text(error.date, style: .date)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                
                // 图片指示器
                if !error.imagePaths.isEmpty {
                    Image(systemName: "photo")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
    
    private var difficultyColor: Color {
        switch error.difficulty {
        case "基础": return .green
        case "中等": return .orange
        case "难题": return .red
        default: return .gray
        }
    }
    
    private var masteryColor: Color {
        switch error.mastery {
        case "已掌握": return .green
        case "基本掌握": return .orange
        case "未掌握": return .red
        default: return .gray
        }
    }
    
    private var masteryIcon: String {
        switch error.mastery {
        case "已掌握": return "checkmark.circle.fill"
        case "基本掌握": return "circle.lefthalf.filled"
        case "未掌握": return "xmark.circle.fill"
        default: return "circle"
        }
    }
}

#Preview {
    ErrorListView(selectedTab: .constant(.allErrors))
        .environmentObject(ErrorViewModel())
}
