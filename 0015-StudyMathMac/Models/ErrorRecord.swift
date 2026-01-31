//
//  ErrorRecord.swift
//  StudyMathMac
//
//  错题记录模型
//

import Foundation
import CoreData

@objc(ErrorRecord)
public class ErrorRecord: NSManagedObject, Identifiable {
    @NSManaged public var id: UUID
    @NSManaged public var date: Date
    @NSManaged public var chapter: String
    @NSManaged public var difficulty: String
    @NSManaged public var mastery: String
    @NSManaged public var questionDescription: String
    @NSManaged public var errorReason: String
    @NSManaged public var correctSolution: String
    @NSManaged public var imagePaths: [String] // 图片文件路径数组
    @NSManaged public var createdAt: Date
    @NSManaged public var updatedAt: Date
}

extension ErrorRecord {
    static func fetchRequest() -> NSFetchRequest<ErrorRecord> {
        return NSFetchRequest<ErrorRecord>(entityName: "ErrorRecord")
    }
    
    // 创建新记录的静态方法
    @MainActor
    static func create(in context: NSManagedObjectContext) -> ErrorRecord {
        let error = ErrorRecord(context: context)
        error.id = UUID()
        error.date = Date()
        error.createdAt = Date()
        error.updatedAt = Date()
        error.imagePaths = []
        error.chapter = ""
        error.difficulty = ""
        error.mastery = ""
        error.questionDescription = ""
        error.errorReason = ""
        error.correctSolution = ""
        return error
    }
    
    // 获取所有记录
    static func fetchAll(context: NSManagedObjectContext) -> [ErrorRecord] {
        let request = fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(keyPath: \ErrorRecord.date, ascending: false)]
        
        do {
            return try context.fetch(request)
        } catch {
            print("获取错题记录失败: \(error)")
            return []
        }
    }
    
    // 根据筛选条件获取
    static func fetch(
        difficulty: DifficultyLevel? = nil,
        mastery: MasteryLevel? = nil,
        searchText: String? = nil,
        context: NSManagedObjectContext
    ) -> [ErrorRecord] {
        let request = fetchRequest()
        var predicates: [NSPredicate] = []
        
        // 难度筛选
        if let difficulty = difficulty, difficulty != .all {
            predicates.append(NSPredicate(format: "difficulty == %@", difficulty.rawValue))
        }
        
        // 掌握程度筛选
        if let mastery = mastery, mastery != .all {
            predicates.append(NSPredicate(format: "mastery == %@", mastery.rawValue))
        }
        
        // 搜索文本
        if let searchText = searchText, !searchText.isEmpty {
            let searchPredicate = NSPredicate(
                format: "chapter CONTAINS[cd] %@ OR questionDescription CONTAINS[cd] %@ OR errorReason CONTAINS[cd] %@",
                searchText, searchText, searchText
            )
            predicates.append(searchPredicate)
        }
        
        if !predicates.isEmpty {
            request.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        }
        
        request.sortDescriptors = [NSSortDescriptor(keyPath: \ErrorRecord.date, ascending: false)]
        
        do {
            return try context.fetch(request)
        } catch {
            print("获取错题记录失败: \(error)")
            return []
        }
    }
}

// 难度等级枚举
enum DifficultyLevel: String, CaseIterable {
    case all = "全部"
    case basic = "基础"
    case medium = "中等"
    case hard = "难题"
}

// 掌握程度枚举
enum MasteryLevel: String, CaseIterable {
    case all = "全部"
    case notMastered = "未掌握"
    case basicMastery = "基本掌握"
    case mastered = "已掌握"
}

// 侧边栏项目
enum SidebarItem: String, CaseIterable {
    case allErrors = "全部错题"
    case basic = "基础题"
    case medium = "中等题"
    case hard = "难题"
    case notMastered = "未掌握"
    case methodologies = "学习方法论"
    case statistics = "统计分析"
    
    var icon: String {
        switch self {
        case .allErrors: return "doc.text.fill"
        case .basic: return "1.circle.fill"
        case .medium: return "2.circle.fill"
        case .hard: return "3.circle.fill"
        case .notMastered: return "exclamationmark.triangle.fill"
        case .methodologies: return "lightbulb.fill"
        case .statistics: return "chart.bar.fill"
        }
    }
}
