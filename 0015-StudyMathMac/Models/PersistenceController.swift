//
//  PersistenceController.swift
//  StudyMathMac
//
//  CoreData 持久化控制器
//

import CoreData

struct PersistenceController {
    static let shared = PersistenceController()
    
    let container: NSPersistentContainer
    
    init(inMemory: Bool = false) {
        container = NSPersistentContainer(name: "StudyMath")
        
        if inMemory {
            container.persistentStoreDescriptions.first!.url = URL(fileURLWithPath: "/dev/null")
        }
        
        container.loadPersistentStores { description, error in
            if let error = error {
                fatalError("无法加载CoreData: \(error)")
            }
        }
        
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }
    
    // 保存上下文
    func save() {
        let context = container.viewContext
        
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                print("保存失败: \(error)")
            }
        }
    }
    
    // 创建预览用的控制器
    static var preview: PersistenceController = {
        let result = PersistenceController(inMemory: true)
        let viewContext = result.container.viewContext
        
        // 创建示例数据
        for i in 0..<10 {
            let error = ErrorRecord.create(in: viewContext)
            error.chapter = "第\(i+1)章 函数"
            error.difficulty = ["基础", "中等", "难题"].randomElement()!
            error.mastery = ["未掌握", "基本掌握", "已掌握"].randomElement()!
            error.questionDescription = "示例题目 \(i+1)"
            error.errorReason = "计算错误"
            error.correctSolution = "正确解法..."
        }
        
        do {
            try viewContext.save()
        } catch {
            fatalError("预览数据创建失败: \(error)")
        }
        
        return result
    }()
}
