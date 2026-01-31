//
//  ErrorDetailView.swift
//  StudyMathMac
//
//  错题详情视图
//

import SwiftUI

// 可识别的图片包装类型
struct IdentifiableImage: Identifiable {
    let id = UUID()
    let image: NSImage
}

struct ErrorDetailView: View {
    let error: ErrorRecord
    @EnvironmentObject var errorViewModel: ErrorViewModel
    @State private var selectedImage: IdentifiableImage?
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // 头部：章节和操作按钮
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(error.chapter)
                            .font(.title)
                            .fontWeight(.bold)
                        
                        Text(error.date, style: .date)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    HStack(spacing: 12) {
                        Button {
                            errorViewModel.selectedError = error
                            errorViewModel.showEditSheet = true
                        } label: {
                            Label("编辑", systemImage: "pencil")
                        }
                        
                        Button(role: .destructive) {
                            errorViewModel.deleteError(error)
                        } label: {
                            Label("删除", systemImage: "trash")
                        }
                    }
                }
                
                Divider()
                
                // 基本信息卡片
                InfoCard(title: "基本信息") {
                    VStack(spacing: 12) {
                        InfoRow(label: "章节", value: error.chapter)
                        InfoRow(label: "难度", value: error.difficulty, color: difficultyColor)
                        InfoRow(label: "掌握程度", value: error.mastery, color: masteryColor)
                        InfoRow(label: "创建时间", value: error.createdAt.formatted())
                        if error.updatedAt != error.createdAt {
                            InfoRow(label: "更新时间", value: error.updatedAt.formatted())
                        }
                    }
                }
                
                // 题目图片
                if !error.imagePaths.isEmpty {
                    InfoCard(title: "题目图片") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(error.imagePaths, id: \.self) { path in
                                    if let image = ImageManager.shared.loadImage(path: path) {
                                        Button {
                                            selectedImage = IdentifiableImage(image: image)
                                        } label: {
                                            Image(nsImage: image)
                                                .resizable()
                                                .scaledToFit()
                                                .frame(height: 200)
                                                .cornerRadius(8)
                                                .shadow(color: .black.opacity(0.1), radius: 4)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                }
                
                // 题目描述
                if !error.questionDescription.isEmpty {
                    InfoCard(title: "题目描述") {
                        Text(error.questionDescription)
                            .textSelection(.enabled)
                    }
                }
                
                // 错误原因
                if !error.errorReason.isEmpty {
                    InfoCard(title: "错误原因") {
                        Text(error.errorReason)
                            .textSelection(.enabled)
                            .foregroundColor(.red)
                    }
                }
                
                // 正确解法
                if !error.correctSolution.isEmpty {
                    InfoCard(title: "正确解法") {
                        Text(error.correctSolution)
                            .textSelection(.enabled)
                            .foregroundColor(.green)
                    }
                }
            }
            .padding(24)
        }
        .sheet(item: $selectedImage) { identifiableImage in
            ImagePreviewSheet(image: identifiableImage.image)
        }
    }
    
    private var difficultyColor: Color {
        switch error.difficulty {
        case "基础": return .green
        case "中等": return .orange
        case "难题": return .red
        default: return .primary
        }
    }
    
    private var masteryColor: Color {
        switch error.mastery {
        case "已掌握": return .green
        case "基本掌握": return .orange
        case "未掌握": return .red
        default: return .primary
        }
    }
}

// 信息卡片
struct InfoCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .foregroundColor(.primary)
            
            content
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }
}

// 信息行
struct InfoRow: View {
    let label: String
    let value: String
    var color: Color = .primary
    
    var body: some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.body)
                .foregroundColor(.secondary)
                .frame(width: 80, alignment: .leading)
            
            Text(value)
                .font(.body)
                .foregroundColor(color)
                .textSelection(.enabled)
            
            Spacer()
        }
    }
}

// 图片预览sheet
struct ImagePreviewSheet: View {
    let image: NSImage
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ZStack {
            Color.black.opacity(0.9)
                .ignoresSafeArea()
            
            VStack {
                HStack {
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title)
                            .foregroundColor(.white)
                    }
                    .buttonStyle(.plain)
                    .padding()
                }
                
                Image(nsImage: image)
                    .resizable()
                    .scaledToFit()
                    .padding()
                
                Spacer()
            }
        }
        .onTapGesture {
            dismiss()
        }
    }
}

#Preview {
    let context = PersistenceController.shared.container.viewContext
    let error = ErrorRecord.create(in: context)
    error.chapter = "二次函数"
    error.difficulty = "中等"
    error.mastery = "部分掌握"
    error.questionDescription = "已知二次函数 f(x) = ax² + bx + c 的图像过点 (1, 2)，且顶点坐标为 (-1, -3)，求该二次函数的解析式。"
    error.errorReason = "没有正确理解顶点式的转换"
    error.correctSolution = "设二次函数为 f(x) = a(x + 1)² - 3，代入点 (1, 2) 得 a = 5/4"
    
    return ErrorDetailView(error: error)
        .environmentObject(ErrorViewModel())
        .frame(width: 600, height: 800)
}
