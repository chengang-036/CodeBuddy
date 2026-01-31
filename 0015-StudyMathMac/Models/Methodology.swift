//
//  Methodology.swift
//  StudyMathMac
//
//  学习方法论模型
//

import Foundation
import CoreData

@objc(Methodology)
public class Methodology: NSManagedObject, Identifiable {
    @NSManaged public var id: UUID
    @NSManaged public var title: String
    @NSManaged public var category: String
    @NSManaged public var content: String
    @NSManaged public var examples: String
    @NSManaged public var createdAt: Date
    @NSManaged public var updatedAt: Date
}

extension Methodology {
    static func fetchRequest() -> NSFetchRequest<Methodology> {
        return NSFetchRequest<Methodology>(entityName: "Methodology")
    }
    
    // 创建新方法论的静态方法
    @MainActor
    static func create(in context: NSManagedObjectContext) -> Methodology {
        let methodology = Methodology(context: context)
        methodology.id = UUID()
        methodology.createdAt = Date()
        methodology.updatedAt = Date()
        methodology.title = ""
        methodology.category = ""
        methodology.content = ""
        methodology.examples = ""
        return methodology
    }
    
    static func fetchAll(context: NSManagedObjectContext) -> [Methodology] {
        let request = fetchRequest()
        request.sortDescriptors = [
            NSSortDescriptor(keyPath: \Methodology.category, ascending: true),
            NSSortDescriptor(keyPath: \Methodology.title, ascending: true)
        ]
        
        do {
            return try context.fetch(request)
        } catch {
            print("获取方法论失败: \(error)")
            return []
        }
    }
}
