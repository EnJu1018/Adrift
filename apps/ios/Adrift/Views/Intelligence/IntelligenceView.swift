import SwiftUI

struct IntelligenceView: View {
    @StateObject private var viewModel = IntelligenceViewModel()

    var body: some View {
        NavigationStack {
            AppPageScrollContainer {
                VStack(alignment: .leading, spacing: AppPageLayout.contentSpacing) {
                    hero

                    GlassProminentButton {
                        Task { await viewModel.generate() }
                    } label: {
                        Label(viewModel.result == nil ? "產生智慧洞察" : "重新產生智慧洞察", systemImage: "sparkles")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .symbolEffect(.pulse, value: viewModel.isLoading)
                    }
                    .disabled(viewModel.isLoading)

                    if viewModel.isLoading {
                        GlassCard {
                            VStack(spacing: 14) {
                                ProgressView()
                                    .controlSize(.large)
                                Text("Adrift Intelligence 正在整理你的生活軌跡...")
                                    .font(.callout)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, minHeight: 150)
                        }
                    } else if let error = viewModel.errorMessage {
                        GlassCard {
                            ContentUnavailableView("暫時無法產生洞察", systemImage: "wifi.exclamationmark", description: Text(error))
                        }
                    } else if let result = viewModel.result {
                        if result.notEnoughData == true {
                            GlassCard {
                                ContentUnavailableView(
                                    "至少需要 3 篇日記，才能產生 Adrift Intelligence 洞察。",
                                    systemImage: "doc.text.magnifyingglass",
                                    description: Text("目前 \(result.current ?? 0) / \(result.required ?? 3) 篇")
                                )
                            }
                        } else {
                            insightContent(result)
                                .transition(.opacity.combined(with: .move(edge: .bottom)))
                        }
                    } else {
                        IntelligenceIntroView()
                    }
                }
            }
            .adriftPageNavigation("Intelligence")
            .animation(AdriftMotion.gentle, value: viewModel.result)
            .animation(AdriftMotion.gentle, value: viewModel.isLoading)
        }
    }

    private var hero: some View {
        GlassCard {
            HStack(alignment: .top, spacing: 16) {
                Image(systemName: "sparkles")
                    .font(.system(size: 36, weight: .semibold))
                    .foregroundStyle(AdriftColors.indigo, AdriftColors.cyan)
                    .symbolEffect(.pulse)
                    .frame(width: 58, height: 58)
                    .background(AdriftColors.indigo.opacity(0.12), in: Circle())

                VStack(alignment: .leading, spacing: 8) {
                    Text("Adrift Intelligence")
                        .font(AdriftTypography.title)
                    Text("根據你的日記、心情與位置，整理出溫和、非診斷式的生活洞察。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func insightContent(_ result: IntelligenceResult) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            InsightSection(title: "整體摘要", systemImage: "text.alignleft", content: result.summary)

            InsightSection(
                title: "情緒趨勢",
                systemImage: "chart.line.uptrend.xyaxis",
                content: "\(result.moodTrend.description)\n主要心情：\(result.moodTrend.dominantMood)\n平均強度：\(String(format: "%.1f", result.moodTrend.averageIntensity))"
            )

            if !result.locationInsights.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Label("地點洞察", systemImage: "mappin.and.ellipse")
                        .font(.headline)
                    ForEach(result.locationInsights) { item in
                        GlassPanel {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.place.isEmpty ? "未命名地點" : item.place)
                                    .font(.subheadline.bold())
                                Text(item.insight)
                                Text("主要心情：\(item.dominantMood)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }

            ListSection(title: "行為模式", systemImage: "point.3.connected.trianglepath.dotted", values: result.behaviorPatterns)
            ListSection(title: "智慧建議", systemImage: "lightbulb", values: result.suggestions)
        }
    }
}

private struct IntelligenceIntroView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("情緒趨勢", systemImage: "chart.line.uptrend.xyaxis")
            Label("地點洞察", systemImage: "mappin.and.ellipse")
            Label("行為模式", systemImage: "point.3.connected.trianglepath.dotted")
            Label("智慧建議", systemImage: "lightbulb")
        }
        .font(.headline)
        .frame(maxWidth: .infinity, alignment: .leading)
        .modifier(GlassCardModifier())
    }
}

private struct InsightSection: View {
    let title: String
    let systemImage: String
    let content: String

    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 8) {
                Label(title, systemImage: systemImage)
                    .font(.headline)
                Text(content.isEmpty ? "暫無資料" : content)
                    .foregroundStyle(content.isEmpty ? .secondary : .primary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct ListSection: View {
    let title: String
    let systemImage: String
    let values: [String]

    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 8) {
                Label(title, systemImage: systemImage)
                    .font(.headline)
                if values.isEmpty {
                    Text("暫無資料")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(values, id: \.self) { value in
                        Text("• \(value)")
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct GlassCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        GlassCard {
            content
        }
    }
}
