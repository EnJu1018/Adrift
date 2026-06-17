import SwiftUI

struct DiaryCard: View {
    let diary: Diary

    var body: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                if !diary.imageURLs.isEmpty {
                    DiaryImageCarousel(urls: diary.imageURLs)
                }

                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(diary.title)
                            .font(.headline)
                        Text(diary.createdAt?.formatted(date: .abbreviated, time: .shortened) ?? "未知時間")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Label(diary.visibility.label, systemImage: diary.visibility.symbol)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                HStack {
                    Label("\(diary.mood.type.label) / \(diary.mood.intensity)", systemImage: diary.mood.type.symbol)
                        .foregroundStyle(.teal)
                    Spacer()
                    if let author = diary.author {
                        Text("@\(author.userCode)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .font(.subheadline)

                if !diary.summary.isEmpty {
                    Text(diary.summary)
                        .font(.body)
                }

                if let placeName = diary.location.placeName, !placeName.isEmpty {
                    Label(placeName, systemImage: "mappin.and.ellipse")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct DiaryImageCarousel: View {
    let urls: [URL]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(urls, id: \.absoluteString) { url in
                    RemoteDiaryImage(url: url)
                }
            }
        }
        .scrollBounceBehavior(.basedOnSize)
    }
}

private struct RemoteDiaryImage: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                RoundedRectangle(cornerRadius: 18)
                    .fill(.ultraThinMaterial)
                    .overlay {
                        ProgressView()
                    }
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            case .failure:
                RoundedRectangle(cornerRadius: 18)
                    .fill(.ultraThinMaterial)
                    .overlay {
                        VStack(spacing: 8) {
                            Image(systemName: "photo")
                                .font(.title3)
                            Text("圖片暫時無法載入")
                                .font(.caption)
                        }
                        .foregroundStyle(.secondary)
                    }
            @unknown default:
                Color.clear
            }
        }
        .frame(width: 280, height: 180)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay {
            RoundedRectangle(cornerRadius: 18)
                .stroke(.white.opacity(0.18), lineWidth: 1)
        }
    }
}
