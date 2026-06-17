import CoreLocation
import PhotosUI
import SwiftUI
import UIKit

struct AddDiaryView: View {
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focusedField: AddDiaryField?
    @ObservedObject var viewModel: MapDiaryViewModel

    @State private var title = ""
    @State private var text = ""
    @State private var mood: MoodKind = .calm
    @State private var intensity = 3.0
    @State private var visibility: DiaryVisibility = .public
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var selectedImageData: Data?
    @State private var selectedImage: UIImage?
    @State private var readableLocationName = "定位中..."
    @State private var coordinateCaption = ""
    @State private var locationError: String?
    @State private var appeared = false

    private let geocoder = CLGeocoder()

    private var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !viewModel.isCreating
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AdriftBackground()
                    .onTapGesture {
                        focusedField = nil
                    }

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 16) {
                        header
                        locationCard
                        contentSection
                        moodSection
                        imageSection
                        visibilitySection

                        if let error = viewModel.errorMessage ?? locationError {
                            Label(error, systemImage: "exclamationmark.triangle")
                                .font(.footnote.weight(.medium))
                                .foregroundStyle(.red)
                                .padding(.top, 2)
                        }
                    }
                    .padding(.horizontal, AppPageLayout.horizontalInset)
                    .padding(.top, 10)
                    .padding(.bottom, 104)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 10)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .adriftPageNavigation("新增漂流日記")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                publishBar
            }
            .onAppear {
                viewModel.prepareLocation()
                appeared = true
                Task { await updateReadableLocation() }
            }
            .onReceive(viewModel.locationManager.$lastLocation) { _ in
                Task { await updateReadableLocation() }
            }
            .onChange(of: selectedPhoto) { _, item in
                Task { await loadPhoto(item) }
            }
            .animation(AdriftMotion.gentle, value: mood)
            .animation(AdriftMotion.gentle, value: selectedImageData)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("新增漂流日記", systemImage: "mappin.and.ellipse")
                .font(AdriftTypography.title)
                .foregroundStyle(.primary)

            Text("把這一刻留在地圖上")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    private var locationCard: some View {
        GlassCard {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(AdriftColors.cyan.opacity(0.16))
                    Image(systemName: "location.fill")
                        .font(.headline)
                        .foregroundStyle(AdriftColors.cyan)
                }
                .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: 4) {
                    Text(readableLocationName)
                        .font(AdriftTypography.section)
                    if !coordinateCaption.isEmpty {
                        Text(coordinateCaption)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                Button {
                    viewModel.recenterOnCurrentLocation()
                    Task { await updateReadableLocation(force: true) }
                } label: {
                    if viewModel.isLocating {
                        ProgressView()
                    } else {
                        Image(systemName: "location")
                    }
                }
                .buttonStyle(.bordered)
                .clipShape(Circle())
                .accessibilityLabel("重新定位")
            }
        }
    }

    private var contentSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("內容")
                .font(.headline)

            GlassCard {
                VStack(spacing: 12) {
                    TextField("標題", text: $title)
                        .font(.headline)
                        .focused($focusedField, equals: .title)
                        .submitLabel(.next)
                        .onSubmit {
                            focusedField = .text
                        }

                    Divider().opacity(0.35)

                    ZStack(alignment: .topLeading) {
                        TextEditor(text: $text)
                            .focused($focusedField, equals: .text)
                            .frame(minHeight: 132)
                            .scrollContentBackground(.hidden)
                            .submitLabel(.return)

                        if text.isEmpty {
                            Text("寫下此刻的風景、情緒或聲音...")
                                .foregroundStyle(.secondary.opacity(0.7))
                                .padding(.top, 8)
                                .padding(.leading, 5)
                                .allowsHitTesting(false)
                        }
                    }
                }
            }
        }
    }

    private var moodSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("心情")
                .font(.headline)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(MoodKind.allCases) { option in
                        Button {
                            mood = option
                        } label: {
                            MoodChip(mood: option, isSelected: mood == option)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }

            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Label("心情強度", systemImage: "waveform.path.ecg")
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text("\(Int(intensity))")
                            .font(.headline.monospacedDigit())
                            .foregroundStyle(AdriftColors.mood(mood))
                            .contentTransition(.numericText())
                    }

                    Slider(value: $intensity, in: 1...5, step: 1)
                        .tint(AdriftColors.mood(mood))
                }
            }
        }
    }

    private var imageSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("圖片")
                .font(.headline)

            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                ZStack {
                    RoundedRectangle(cornerRadius: 24)
                        .fill(.ultraThinMaterial)
                        .overlay {
                            RoundedRectangle(cornerRadius: 24)
                                .stroke(AdriftColors.cyan.opacity(0.22), lineWidth: 1)
                        }

                    if let previewImage = selectedImage {
                        Image(uiImage: previewImage)
                            .resizable()
                            .scaledToFill()
                            .frame(maxWidth: .infinity)
                            .frame(height: 190)
                            .clipShape(RoundedRectangle(cornerRadius: 24))
                            .overlay(alignment: .topTrailing) {
                                Button {
                                    selectedPhoto = nil
                                    selectedImage = nil
                                    selectedImageData = nil
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(.white)
                                        .frame(width: 30, height: 30)
                                        .background(.black.opacity(0.45), in: Circle())
                                }
                                .buttonStyle(.plain)
                                .padding(10)
                            }
                    } else {
                        VStack(spacing: 10) {
                            Image(systemName: "photo.on.rectangle.angled")
                                .font(.title2)
                                .foregroundStyle(AdriftColors.cyan)
                            Text("加入一張照片")
                                .font(.subheadline.weight(.semibold))
                            Text("讓這個座標更有畫面")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .frame(height: 190)
                .shadow(color: AdriftColors.ocean.opacity(0.08), radius: 14, y: 6)
            }
            .buttonStyle(.plain)
        }
    }

    private var visibilitySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("可見性")
                .font(.headline)

            Picker("可見性", selection: $visibility) {
                ForEach(DiaryVisibility.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var publishBar: some View {
        VStack(spacing: 0) {
            Button {
                Task { await submit() }
            } label: {
                HStack {
                    if viewModel.isCreating {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "paperplane.fill")
                    }
                    Text(viewModel.isCreating ? "發布中..." : "發布日記")
                }
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    LinearGradient(colors: [AdriftColors.ocean, AdriftColors.cyan], startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 18)
                )
                .shadow(color: AdriftColors.cyan.opacity(0.24), radius: 16, y: 7)
            }
            .buttonStyle(.plain)
            .disabled(!canSubmit)
            .opacity(canSubmit ? 1 : 0.55)
            .padding(.horizontal, AppPageLayout.horizontalInset)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
        }
    }

    private func submit() async {
        focusedField = nil
        let ok = await viewModel.createDiary(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            text: text.trimmingCharacters(in: .whitespacesAndNewlines),
            mood: mood,
            intensity: Int(intensity),
            visibility: visibility,
            placeName: readableLocationName == "定位中..." ? "目前位置附近" : readableLocationName,
            imageData: selectedImageData,
            imageMimeType: "image/jpeg"
        )
        if ok { dismiss() }
    }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else { return }

        selectedImage = image
        selectedImageData = image.resizedForDiaryUpload().jpegData(compressionQuality: 0.82)
    }

    private func updateReadableLocation(force: Bool = false) async {
        guard let location = viewModel.locationManager.lastLocation else {
            readableLocationName = "定位中..."
            coordinateCaption = ""
            return
        }

        let coordinate = location.coordinate
        coordinateCaption = "\(String(format: "%.5f", coordinate.latitude)), \(String(format: "%.5f", coordinate.longitude))"

        if !force, readableLocationName != "定位中...", readableLocationName != "目前位置附近" {
            return
        }

        do {
            let placemarks = try await geocoder.reverseGeocodeLocation(location, preferredLocale: Locale(identifier: "zh_TW"))
            readableLocationName = Self.displayName(from: placemarks.first)
            locationError = nil
        } catch {
            readableLocationName = "目前位置附近"
            locationError = nil
        }
    }

    private static func displayName(from placemark: CLPlacemark?) -> String {
        guard let placemark else { return "目前位置附近" }

        let city = placemark.locality ?? placemark.administrativeArea
        let district = placemark.subLocality

        if let city, let district, city != district {
            return "\(city)\(district)"
        }

        if let city {
            return city
        }

        return placemark.name ?? "目前位置附近"
    }
}

private enum AddDiaryField: Hashable {
    case title
    case text
}

private extension UIImage {
    func resizedForDiaryUpload(maxSide: CGFloat = 1600) -> UIImage {
        let longestSide = max(size.width, size.height)
        guard longestSide > maxSide else { return self }

        let scale = maxSide / longestSide
        let targetSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        return renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: targetSize))
        }
    }
}
