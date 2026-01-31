//
//  SidebarView.swift
//  StudyMathMac
//
//  侧边栏视图
//

import SwiftUI

struct SidebarView: View {
    @Binding var selectedTab: SidebarItem
    @EnvironmentObject var errorViewModel: ErrorViewModel
    
    var body: some View {
        List(selection: $selectedTab) {
            Section("错题分类") {
                ForEach([SidebarItem.allErrors, .basic, .medium, .hard, .notMastered], id: \.self) { item in
                    NavigationLink(value: item) {
                        Label(item.rawValue, systemImage: item.icon)
                    }
                    .tag(item)
                }
            }
            
            Section("其他功能") {
                NavigationLink(value: SidebarItem.methodologies) {
                    Label(SidebarItem.methodologies.rawValue, systemImage: SidebarItem.methodologies.icon)
                }
                .tag(SidebarItem.methodologies)
                
                NavigationLink(value: SidebarItem.statistics) {
                    Label(SidebarItem.statistics.rawValue, systemImage: SidebarItem.statistics.icon)
                }
                .tag(SidebarItem.statistics)
            }
            
            Section("统计信息") {
                VStack(alignment: .leading, spacing: 8) {
                    StatRow(label: "总题数", value: "\(errorViewModel.totalCount)")
                    StatRow(label: "未掌握", value: "\(errorViewModel.notMasteredCount)")
                    StatRow(label: "薄弱章节", value: errorViewModel.weakestChapter)
                }
                .padding(.vertical, 8)
            }
        }
        .listStyle(.sidebar)
    }
}

struct StatRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

#Preview {
    SidebarView(selectedTab: .constant(.allErrors))
        .environmentObject(ErrorViewModel())
        .frame(width: 250)
}
