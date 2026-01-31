//
//  ErrorEditView.swift
//  StudyMathMac
//
//  错题编辑视图
//

import SwiftUI
import UniformTypeIdentifiers

enum EditMode {
    case add
    case edit(ErrorRecord)
}

struct ErrorEditView: View {
    let mode: EditMode
    @EnvironmentObject var errorViewModel: ErrorViewModel
    @Environment(\.dismiss) var dismiss
    
    @State private var chapter: String = ""
    @State private var difficulty: String = "中等"
    @State private var mastery: String = "未掌握"
    @State private var questionDescription: String = ""
    @State private var errorReason: String = ""
    @State private var correctSolution: String = ""
    @State private var selectedImages: [NSImage] = []
    @State private var existingImages: [String] = []
    
    @State private var isRecognizing = false
    @State private var showingImagePicker = false
    
    init(mode: EditMode) {
        self.mode = mode
        
        if case .edit(let error) = mode {
            _chapter = State(initialValue: error.chapter)
            _difficulty = State(initialValue: error.difficulty)
            _mastery = State(initialValue: error.mastery)
            _questionDescription = State(initialValue: error.questionDescription)
            _errorReason = State(initialValue: error.errorReason)
            _correctSolution = State(initialValue: error.correctSolution)
            _existingImages = State(initialValue: error.imagePaths)
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                // 基本信息
                Section("基本信息") {
                    TextField("章节/知识点", text: $chapter)
                    
                    Picker("难度等级", selection: $difficulty) {
                        ForEach(["基础", "中等", "难题"], id: \.self) { level in
                            Text(level).tag(level)
                        }
                    }
                    
                    Picker("掌握程度", selection: $mastery) {
                        ForEach(["未掌握", "基本掌握", "已掌握"], id: \.self) { level in
                            Text(level).tag(level)
                        }
                    }
                }
                
                // 题目图片
                Section("题目图片") {
                    VStack(alignment: .leading, spacing: 12) {
                        // 显示已有图片
                        if !existingImages.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(existingImages, id: \.self) { path in
                                        if let image = ImageManager.shared.loadImage(path: path) {
                                            ZStack(alignment: .topTrailing) {
                                                Image(nsImage: image)
                                                    .resizable()
                                                    .scaledToFit()
                                                    .frame(height: 120)
                                                    .cornerRadius(8)
                                                
                                                Button {
                                                    existingImages.removeAll { $0 == path }
                                                } label: {
                                                    Image(systemName: "xmark.circle.fill")
                                                        .foregroundColor(.red)
                                                }
                                                .buttonStyle(.plain)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        // 显示新选择的图片
                        if !selectedImages.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(Array(selectedImages.enumerated()), id: \.offset) { index, image in
                                        ZStack(alignment: .topTrailing) {
                                            Image(nsImage: image)
                                                .resizable()
                                                .scaledToFit()
                                                .frame(height: 120)
                                                .cornerRadius(8)
                                            
                                            Button {
                                                selectedImages.remove(at: index)
                                            } label: {
                                                Image(systemName: "xmark.circle.fill")
                                                    .foregroundColor(.red)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }
                            }
                        }
                        
                        // 操作按钮
                        HStack(spacing: 12) {
                            Button {
                                showingImagePicker = true
                            } label: {
                                Label("选择图片", systemImage: "photo")
                            }
                            
                            Button {
                                pasteImage()
                            } label: {
                                Label("粘贴图片", systemImage: "doc.on.clipboard")
                            }
                            
                            if !selectedImages.isEmpty {
                                Button {
                                    recognizeImages()
                                } label: {
                                    if isRecognizing {
                                        ProgressView()
                                            .scaleEffect(0.7)
                                    } else {
                                        Label("AI识别", systemImage: "sparkles")
                                    }
                                }
                                .disabled(isRecognizing)
                            }
                        }
                    }
                }
                
                // 题目信息
                Section("题目内容") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("题目描述")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextEditor(text: $questionDescription)
                            .frame(height: 120)
                            .font(.body)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("错误原因")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextEditor(text: $errorReason)
                            .frame(height: 100)
                            .font(.body)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("正确解法")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextEditor(text: $correctSolution)
                            .frame(height: 100)
                            .font(.body)
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle(mode.isEditing ? "编辑错题" : "新增错题")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        saveError()
                    }
                    .disabled(chapter.isEmpty)
                }
            }
        }
        .frame(width: 700, height: 800)
        .fileImporter(
            isPresented: $showingImagePicker,
            allowedContentTypes: [.image],
            allowsMultipleSelection: true
        ) { result in
            handleImageSelection(result)
        }
    }
    
    private func handleImageSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            for url in urls {
                if let image = NSImage(contentsOf: url) {
                    selectedImages.append(image)
                }
            }
        case .failure(let error):
            print("图片选择失败: \(error)")
        }
    }
    
    private func pasteImage() {
        let pasteboard = NSPasteboard.general
        if let image = NSImage(pasteboard: pasteboard) {
            selectedImages.append(image)
        }
    }
    
    private func recognizeImages() {
        guard !selectedImages.isEmpty else { return }
        
        isRecognizing = true
        
        Task {
            do {
                let result = try await DouBaoService.shared.recognizeImages(selectedImages)
                
                await MainActor.run {
                    if !questionDescription.isEmpty {
                        questionDescription += "\n\n"
                    }
                    questionDescription += result
                    isRecognizing = false
                }
            } catch {
                await MainActor.run {
                    print("AI识别失败: \(error)")
                    isRecognizing = false
                }
            }
        }
    }
    
    private func saveError() {
        // 合并所有图片
        let allImages = selectedImages
        
        if case .edit(let error) = mode {
            // 更新现有错题
            errorViewModel.updateError(
                error,
                chapter: chapter,
                difficulty: difficulty,
                mastery: mastery,
                description: questionDescription,
                reason: errorReason,
                solution: correctSolution,
                images: allImages
            )
        } else {
            // 新增错题
            errorViewModel.addError(
                chapter: chapter,
                difficulty: difficulty,
                mastery: mastery,
                description: questionDescription,
                reason: errorReason,
                solution: correctSolution,
                images: allImages
            )
        }
        
        dismiss()
    }
}

extension EditMode {
    var isEditing: Bool {
        if case .edit = self {
            return true
        }
        return false
    }
}

#Preview {
    ErrorEditView(mode: .add)
        .environmentObject(ErrorViewModel())
}
