//
//  ImageManager.swift
//  StudyMathMac
//
//  图片管理服务
//

import Foundation
import AppKit

class ImageManager {
    static let shared = ImageManager()
    
    // 图片存储目录
    private let imagesDirectory: URL
    
    private init() {
        // 获取应用支持目录
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appDirectory = appSupport.appendingPathComponent("StudyMathMac")
        imagesDirectory = appDirectory.appendingPathComponent("Images")
        
        // 创建目录
        try? FileManager.default.createDirectory(at: imagesDirectory, withIntermediateDirectories: true)
    }
    
    // 保存图片
    func saveImages(_ images: [NSImage], for errorId: UUID) -> [String] {
        var paths: [String] = []
        
        let errorDirectory = imagesDirectory.appendingPathComponent(errorId.uuidString)
        try? FileManager.default.createDirectory(at: errorDirectory, withIntermediateDirectories: true)
        
        for (index, image) in images.enumerated() {
            let filename = "image_\(index + 1).jpg"
            let fileURL = errorDirectory.appendingPathComponent(filename)
            
            if let tiffData = image.tiffRepresentation,
               let bitmapImage = NSBitmapImageRep(data: tiffData),
               let jpegData = bitmapImage.representation(using: .jpeg, properties: [.compressionFactor: 0.8]) {
                do {
                    try jpegData.write(to: fileURL)
                    paths.append(fileURL.path)
                } catch {
                    print("保存图片失败: \(error)")
                }
            }
        }
        
        return paths
    }
    
    // 加载图片（通过路径）
    func loadImage(path: String) -> NSImage? {
        return NSImage(contentsOfFile: path)
    }
    
    // 加载图片（批量）
    func loadImages(from paths: [String]) -> [NSImage] {
        return paths.compactMap { path in
            NSImage(contentsOfFile: path)
        }
    }
    
    // 删除错题的所有图片
    func deleteImages(for errorId: UUID) {
        let errorDirectory = imagesDirectory.appendingPathComponent(errorId.uuidString)
        try? FileManager.default.removeItem(at: errorDirectory)
    }
    
    // 获取存储大小
    func getStorageSize() -> String {
        let size = directorySize(at: imagesDirectory)
        return ByteCountFormatter.string(fromByteCount: size, countStyle: .file)
    }
    
    // 计算目录大小
    private func directorySize(at url: URL) -> Int64 {
        guard let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey]) else {
            return 0
        }
        
        var totalSize: Int64 = 0
        for case let fileURL as URL in enumerator {
            guard let resourceValues = try? fileURL.resourceValues(forKeys: [.fileSizeKey]),
                  let fileSize = resourceValues.fileSize else {
                continue
            }
            totalSize += Int64(fileSize)
        }
        
        return totalSize
    }
}
