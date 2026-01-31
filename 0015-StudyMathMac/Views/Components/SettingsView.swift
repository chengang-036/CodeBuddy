//
//  SettingsView.swift
//  StudyMathMac
//
//  设置视图
//

import SwiftUI

struct SettingsView: View {
    @AppStorage("doubaoApiKey") private var apiKey: String = ""
    @AppStorage("doubaoEndpointId") private var endpointId: String = ""
    @AppStorage("autoSaveInterval") private var autoSaveInterval: Int = 5
    @AppStorage("imageQuality") private var imageQuality: Double = 0.8
    
    var body: some View {
        TabView {
            // 通用设置
            Form {
                Section("AI设置") {
                    TextField("API Key", text: $apiKey)
                        .textFieldStyle(.roundedBorder)
                    
                    TextField("Endpoint ID", text: $endpointId)
                        .textFieldStyle(.roundedBorder)
                    
                    Text("配置豆包AI识别服务")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Section("自动保存") {
                    Stepper("间隔: \(autoSaveInterval) 分钟", value: $autoSaveInterval, in: 1...30)
                }
                
                Section("图片质量") {
                    Slider(value: $imageQuality, in: 0.1...1.0) {
                        Text("压缩质量")
                    }
                    Text("当前: \(Int(imageQuality * 100))%")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Section("存储") {
                    HStack {
                        Text("图片存储大小")
                        Spacer()
                        Text(ImageManager.shared.getStorageSize())
                            .foregroundColor(.secondary)
                    }
                    
                    Button("清理缓存") {
                        // 实现清理逻辑
                    }
                }
            }
            .formStyle(.grouped)
            .frame(width: 400)
            .tabItem {
                Label("通用", systemImage: "gear")
            }
            
            // 关于
            VStack(spacing: 20) {
                Image(systemName: "book.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.blue)
                
                Text("高中数学错题本")
                    .font(.title)
                    .fontWeight(.bold)
                
                Text("版本 1.0.0")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Divider()
                    .frame(width: 200)
                
                Text("一个帮助学生管理和分析错题的应用")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(width: 300)
                
                Spacer()
            }
            .padding(40)
            .frame(width: 400, height: 400)
            .tabItem {
                Label("关于", systemImage: "info.circle")
            }
        }
    }
}

#Preview {
    SettingsView()
}
