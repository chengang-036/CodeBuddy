//
//  DouBaoService.swift
//  StudyMathMac
//
//  豆包AI识别服务
//

import Foundation
import AppKit

class DouBaoService {
    static let shared = DouBaoService()
    
    // 配置信息（从UserDefaults读取）
    private var apiKey: String {
        UserDefaults.standard.string(forKey: "doubaoApiKey") ?? ""
    }
    
    private var endpointId: String {
        UserDefaults.standard.string(forKey: "doubaoEndpointId") ?? ""
    }
    
    private let endpoint = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    
    private init() {}
    
    // 识别图片中的题目
    func recognizeQuestion(from image: NSImage) async throws -> String {
        // 检查配置
        guard !apiKey.isEmpty, !endpointId.isEmpty else {
            throw DouBaoError.configurationMissing
        }
        
        // 转换图片为Base64
        guard let base64Image = image.base64String() else {
            throw DouBaoError.imageConversionFailed
        }
        
        // 构建请求
        let request = createRequest(with: base64Image)
        
        // 发送请求
        let (data, response) = try await URLSession.shared.data(for: request)
        
        // 检查响应
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DouBaoError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw DouBaoError.httpError(httpResponse.statusCode)
        }
        
        // 解析响应
        let result = try JSONDecoder().decode(DouBaoResponse.self, from: data)
        
        guard let content = result.choices.first?.message.content else {
            throw DouBaoError.noContent
        }
        
        return content
    }
    
    // 批量识别多张图片
    func recognizeImages(_ images: [NSImage]) async throws -> String {
        var results: [String] = []
        
        for (index, image) in images.enumerated() {
            let result = try await recognizeQuestion(from: image)
            results.append("【图片\(index + 1)】\n\(result)")
        }
        
        return results.joined(separator: "\n\n")
    }
    
    // 创建请求
    private func createRequest(with base64Image: String) -> URLRequest {
        var request = URLRequest(url: URL(string: endpoint)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        
        let requestBody: [String: Any] = [
            "model": endpointId,
            "messages": [
                [
                    "role": "user",
                    "content": [
                        [
                            "type": "image_url",
                            "image_url": ["url": base64Image]
                        ],
                        [
                            "type": "text",
                            "text": """
                            请识别这张图片中的数学题目。注意：
                            1. 只提取印刷体的题目文字，忽略手写的答案和笔记
                            2. 保留题目的完整性，包括题号
                            3. 如果有数学公式，用LaTeX格式表示（如 $x^2$, $\\frac{a}{b}$）
                            4. 直接输出题目文字，不要添加任何解释
                            5. 如果无法识别出题目，返回"未识别到题目"
                            """
                        ]
                    ]
                ]
            ],
            "temperature": 0.3,
            "max_tokens": 2000
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: requestBody)
        
        return request
    }
}

// MARK: - 响应模型
struct DouBaoResponse: Codable {
    let choices: [Choice]
    
    struct Choice: Codable {
        let message: Message
    }
    
    struct Message: Codable {
        let content: String
    }
}

// MARK: - 错误类型
enum DouBaoError: LocalizedError {
    case configurationMissing
    case imageConversionFailed
    case invalidResponse
    case httpError(Int)
    case noContent
    
    var errorDescription: String? {
        switch self {
        case .configurationMissing:
            return "请先配置豆包API（API Key和Endpoint ID）"
        case .imageConversionFailed:
            return "图片转换失败"
        case .invalidResponse:
            return "无效的响应"
        case .httpError(let code):
            return "HTTP错误：\(code)"
        case .noContent:
            return "未识别到题目内容"
        }
    }
}

// MARK: - NSImage扩展
extension NSImage {
    func base64String() -> String? {
        guard let tiffData = tiffRepresentation,
              let bitmapImage = NSBitmapImageRep(data: tiffData),
              let jpegData = bitmapImage.representation(using: .jpeg, properties: [.compressionFactor: 0.8]) else {
            return nil
        }
        
        let base64 = jpegData.base64EncodedString()
        return "data:image/jpeg;base64,\(base64)"
    }
}
