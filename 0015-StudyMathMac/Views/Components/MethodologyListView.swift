//
//  MethodologyListView.swift
//  StudyMathMac
//
//  学习方法论列表视图
//

import SwiftUI

struct MethodologyListView: View {
    @EnvironmentObject var viewModel: MethodologyViewModel
    @Environment(\.dismiss) var dismiss
    @State private var selectedMethodology: Methodology?
    
    var body: some View {
        NavigationSplitView {
            List(viewModel.methodologies, id: \.id, selection: $selectedMethodology) { methodology in
                VStack(alignment: .leading, spacing: 4) {
                    Text(methodology.title)
                        .font(.headline)
                    Text(methodology.category)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .tag(methodology)
                .contextMenu {
                    Button("编辑") {
                        viewModel.selectedMethodology = methodology
                        viewModel.showEditSheet = true
                    }
                    Button("删除", role: .destructive) {
                        viewModel.deleteMethodology(methodology)
                    }
                }
            }
            .listStyle(.sidebar)
            .navigationTitle("学习方法论")
            .toolbar {
                Button {
                    viewModel.showAddSheet = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        } detail: {
            if let methodology = selectedMethodology {
                MethodologyDetailView(methodology: methodology)
            } else {
                Text("选择一个方法论查看详情")
                    .foregroundColor(.secondary)
            }
        }
        .frame(width: 900, height: 600)
        .sheet(isPresented: $viewModel.showAddSheet) {
            MethodologyEditView(mode: .add)
        }
        .sheet(isPresented: $viewModel.showEditSheet) {
            if let methodology = viewModel.selectedMethodology {
                MethodologyEditView(mode: .edit(methodology))
            }
        }
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("完成") {
                    dismiss()
                }
            }
        }
    }
}

struct MethodologyDetailView: View {
    let methodology: Methodology
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(methodology.title)
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text(methodology.category)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(Color.blue.opacity(0.2))
                        .cornerRadius(8)
                }
                
                Divider()
                
                VStack(alignment: .leading, spacing: 12) {
                    Text("方法内容")
                        .font(.headline)
                    
                    Text(methodology.content)
                        .textSelection(.enabled)
                }
                
                if !methodology.examples.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("应用示例")
                            .font(.headline)
                        
                        Text(methodology.examples)
                            .textSelection(.enabled)
                            .padding()
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(8)
                    }
                }
            }
            .padding(24)
        }
    }
}

enum MethodologyEditMode {
    case add
    case edit(Methodology)
}

struct MethodologyEditView: View {
    let mode: MethodologyEditMode
    @EnvironmentObject var viewModel: MethodologyViewModel
    @Environment(\.dismiss) var dismiss
    
    @State private var title: String = ""
    @State private var category: String = "解题方法"
    @State private var content: String = ""
    @State private var examples: String = ""
    
    let categories = ["解题方法", "思维方式", "学习技巧", "知识总结"]
    
    init(mode: MethodologyEditMode) {
        self.mode = mode
        
        if case .edit(let methodology) = mode {
            _title = State(initialValue: methodology.title)
            _category = State(initialValue: methodology.category)
            _content = State(initialValue: methodology.content)
            _examples = State(initialValue: methodology.examples)
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("基本信息") {
                    TextField("标题", text: $title)
                    
                    Picker("分类", selection: $category) {
                        ForEach(categories, id: \.self) { cat in
                            Text(cat).tag(cat)
                        }
                    }
                }
                
                Section("方法内容") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("内容")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextEditor(text: $content)
                            .frame(height: 150)
                            .font(.body)
                    }
                }
                
                Section("应用示例（可选）") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("示例")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextEditor(text: $examples)
                            .frame(height: 120)
                            .font(.body)
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle(mode.isEditing ? "编辑方法论" : "新增方法论")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        saveMethodology()
                    }
                    .disabled(title.isEmpty || content.isEmpty)
                }
            }
        }
        .frame(width: 600, height: 600)
    }
    
    private func saveMethodology() {
        if case .edit(let methodology) = mode {
            viewModel.updateMethodology(
                methodology,
                title: title,
                category: category,
                content: content,
                examples: examples
            )
        } else {
            viewModel.addMethodology(
                title: title,
                category: category,
                content: content,
                examples: examples
            )
        }
        
        dismiss()
    }
}

extension MethodologyEditMode {
    var isEditing: Bool {
        if case .edit = self {
            return true
        }
        return false
    }
}

#Preview {
    MethodologyListView()
        .environmentObject(MethodologyViewModel())
}
