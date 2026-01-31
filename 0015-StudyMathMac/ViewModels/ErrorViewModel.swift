//
//  ErrorViewModel.swift
//  StudyMathMac
//
//  错题视图模型
//

import SwiftUI
import CoreData
import Combine

class ErrorViewModel: ObservableObject {
    // Published属性
    @Published var errors: [ErrorRecord] = []
    @Published var selectedError: ErrorRecord?
    @Published var searchText: String = ""
    @Published var filterDifficulty: DifficultyLevel = .all
    @Published var filterMastery: MasteryLevel = .all
    
    // UI状态
    @Published var showAddSheet = false
    @Published var showEditSheet = false
    @Published var showImportPanel = false
    @Published var showExportPanel = false
    @Published var showSidebar = true
    
    // 统计信息
    @Published var totalCount = 0
    @Published var notMasteredCount = 0
    @Published var weakestChapter = "-"
    
    private var cancellables = Set<AnyCancellable>()
    private let context = PersistenceController.shared.container.viewContext
    
    init() {
        setupObservers()
        loadErrors()
        updateStatistics()
    }
    
    // 设置观察者
    private func setupObservers() {
        // 监听搜索和筛选变化
        Publishers.CombineLatest3($searchText, $filterDifficulty, $filterMastery)
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] _, _, _ in
                self?.loadErrors()
            }
            .store(in: &cancellables)
    }
    
    // 加载错题列表
    func loadErrors() {
        errors = ErrorRecord.fetch(
            difficulty: filterDifficulty,
            mastery: filterMastery,
            searchText: searchText.isEmpty ? nil : searchText,
            context: context
        )
        updateStatistics()
    }
    
    // 更新统计信息
    func updateStatistics() {
        let allErrors = ErrorRecord.fetchAll(context: context)
        totalCount = allErrors.count
        notMasteredCount = allErrors.filter { $0.mastery == "未掌握" }.count
        
        // 计算最薄弱章节
        let chapters = Dictionary(grouping: allErrors.filter { $0.mastery == "未掌握" }, by: { $0.chapter })
        let sorted = chapters.sorted { $0.value.count > $1.value.count }
        weakestChapter = sorted.first?.key ?? "-"
    }
    
    // 添加错题
    func addError(
        chapter: String,
        difficulty: String,
        mastery: String,
        description: String,
        reason: String,
        solution: String,
        images: [NSImage]
    ) {
        let error = ErrorRecord.create(in: context)
        error.chapter = chapter
        error.difficulty = difficulty
        error.mastery = mastery
        error.questionDescription = description
        error.errorReason = reason
        error.correctSolution = solution
        
        // 保存图片并记录路径
        error.imagePaths = ImageManager.shared.saveImages(images, for: error.id)
        
        PersistenceController.shared.save()
        loadErrors()
    }
    
    // 更新错题
    func updateError(
        _ error: ErrorRecord,
        chapter: String,
        difficulty: String,
        mastery: String,
        description: String,
        reason: String,
        solution: String,
        images: [NSImage]
    ) {
        error.chapter = chapter
        error.difficulty = difficulty
        error.mastery = mastery
        error.questionDescription = description
        error.errorReason = reason
        error.correctSolution = solution
        error.updatedAt = Date()
        
        // 删除旧图片，保存新图片
        ImageManager.shared.deleteImages(for: error.id)
        error.imagePaths = ImageManager.shared.saveImages(images, for: error.id)
        
        PersistenceController.shared.save()
        loadErrors()
    }
    
    // 删除错题
    func deleteError(_ error: ErrorRecord) {
        // 删除图片文件
        ImageManager.shared.deleteImages(for: error.id)
        
        // 删除记录
        context.delete(error)
        PersistenceController.shared.save()
        
        if selectedError?.id == error.id {
            selectedError = nil
        }
        
        loadErrors()
    }
    
    // 粘贴图片
    func pasteImage() {
        let pasteboard = NSPasteboard.general
        if NSImage(pasteboard: pasteboard) != nil {
            // 处理粘贴的图片
            print("粘贴图片成功")
        }
    }
    
    // 切换侧边栏
    func toggleSidebar() {
        showSidebar.toggle()
    }
    
    // 刷新列表
    func refreshList() {
        loadErrors()
    }
}
