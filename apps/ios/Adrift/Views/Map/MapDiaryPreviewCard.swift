import SwiftUI

struct MapDiaryPreviewCard: View {
    let diary: Diary
    let onOpen: () -> Void
    let onClose: () -> Void

    private var author: PublicUser {
        diary.author ?? PublicUser(id: "unknown-author", name: "Adrift 使用者", userCode: "")
    }

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 12) {
                header

                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(diary.title)
                            .font(.system(.headline, design: .rounded, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)

                        if !diary.summary.isEmpty {
                            Text(diary.summary)
                                .font(.subheadline)
                                .foregroundStyle(.white.opacity(0.72))
                                .lineLimit(3)
                                .multilineTextAlignment(.leading)
                        }
                    }

                    Spacer(minLength: 4)

                    if let url = diary.imageURLs.first {
                        MapDiaryThumbnail(url: url)
                    }
                }

                HStack(spacing: 8) {
                    DiaryMoodBadge(mood: diary.mood)
                    LocationLabelView(placeName: diary.location.placeName)

                    Spacer(minLength: 6)

                    Label(diary.visibility.label, systemImage: diary.visibility.symbol)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.white.opacity(0.62))
                        .lineLimit(1)
                }

                HStack(spacing: 6) {
                    Text("查看完整日記")
                        .font(.footnote.weight(.semibold))
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                }
                .foregroundStyle(AdriftColors.cyan)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.26), AdriftColors.cyan.opacity(0.18), .white.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            }
            .shadow(color: .black.opacity(0.24), radius: 24, y: 12)
            .shadow(color: AdriftColors.cyan.opacity(0.16), radius: 30, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityHint("點兩下查看完整日記")
    }

    private var header: some View {
        HStack(spacing: 10) {
            AvatarView(name: author.name, avatarUrl: author.avatarUrl, size: 38)
                .overlay {
                    Circle()
                        .stroke(AdriftColors.cyan.opacity(0.24), lineWidth: 1)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(author.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                Text(relativeTime)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.62))
            }

            Spacer()

            Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.72))
                    .frame(width: 30, height: 30)
                    .background(.thinMaterial, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("關閉日記預覽")
        }
    }

    private var cardBackground: some ShapeStyle {
        LinearGradient(
            colors: [
                Color(red: 0.04, green: 0.08, blue: 0.13).opacity(0.88),
                Color(red: 0.06, green: 0.13, blue: 0.19).opacity(0.80)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var relativeTime: String {
        guard let createdAt = diary.createdAt else { return "未知時間" }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "zh_TW")
        formatter.unitsStyle = .short
        return formatter.localizedString(for: createdAt, relativeTo: Date())
    }
}

struct DiaryMoodBadge: View {
    let mood: Mood

    var body: some View {
        Label("\(mood.type.label) \(mood.intensity)", systemImage: mood.type.symbol)
            .font(.caption.weight(.semibold))
            .foregroundStyle(AdriftColors.mood(mood.type))
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(AdriftColors.mood(mood.type).opacity(0.15), in: Capsule())
    }
}

struct LocationLabelView: View {
    let placeName: String?

    var body: some View {
        Label(displayName, systemImage: "mappin.and.ellipse")
            .font(.caption.weight(.medium))
            .foregroundStyle(.white.opacity(0.68))
            .lineLimit(1)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(.white.opacity(0.10), in: Capsule())
    }

    private var displayName: String {
        guard let placeName, !placeName.isEmpty else { return "目前位置附近" }
        return placeName
    }
}

private struct MapDiaryThumbnail: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay {
                        ProgressView()
                            .tint(AdriftColors.cyan)
                    }
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            case .failure:
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay {
                        Image(systemName: "photo")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
            @unknown default:
                Color.clear
            }
        }
        .frame(width: 96, height: 82)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(.white.opacity(0.16), lineWidth: 1)
        }
    }
}
