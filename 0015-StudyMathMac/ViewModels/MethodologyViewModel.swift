//
//  MethodologyViewModel.swift
//  StudyMathMac
//
//  学习方法论视图模型
//

import SwiftUI
import CoreData
import Combine

class MethodologyViewModel: ObservableObject {
    @Published var methodologies: [Methodology] = []
    @Published var selectedMethodology: Methodology?
    @Published var showMethodologyList = false
    @Published var showAddSheet = false
    @Published var showEditSheet = false
    
    private let context = PersistenceController.shared.container.viewContext
    
    init() {
        loadMethodologies()
    }
    
    func loadMethodologies() {
        methodologies = Methodology.fetchAll(context: context)
    }
    
    func addMethodology(
        title: String,
        category: String,
        content: String,
        examples: String
    ) {
        let methodology = Methodology.create(in: context)
        methodology.title = title
        methodology.category = category
        methodology.content = content
        methodology.examples = examples
        
        PersistenceController.shared.save()
        loadMethodologies()
    }
    
    func updateMethodology(
        _ methodology: Methodology,
        title: String,
        category: String,
        content: String,
        examples: String
    ) {
        methodology.title = title
        methodology.category = category
        methodology.content = content
        methodology.examples = examples
        methodology.updatedAt = Date()
        
        PersistenceController.shared.save()
        loadMethodologies()
    }
    
    func deleteMethodology(_ methodology: Methodology) {
        context.delete(methodology)
        PersistenceController.shared.save()
        
        if selectedMethodology?.id == methodology.id {
            selectedMethodology = nil
        }
        
        loadMethodologies()
    }
}
