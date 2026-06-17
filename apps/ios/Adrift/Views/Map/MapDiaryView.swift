import MapKit
import SwiftUI

struct MapDiaryView: View {
    @ObservedObject var viewModel: MapDiaryViewModel
    @EnvironmentObject private var refreshManager: AppRefreshManager
    @State private var selectedDiaryId: String?
    @State private var showingAddDiary = false
    @State private var detailDiary: Diary?

    var body: some View {
        NavigationStack {
            ZStack {
                Map(position: $viewModel.cameraPosition, selection: $selectedDiaryId) {
                    UserAnnotation(anchor: .center) {
                        UserLocationDotView()
                    }

                    ForEach(viewModel.diaries) { diary in
                        if let coordinate = diary.coordinate {
                            Annotation(diary.title, coordinate: coordinate) {
                                MemoryMarkerView(mood: diary.mood.type, isSelected: selectedDiaryId == diary.id)
                            }
                            .tag(diary.id)
                        }
                    }
                }
                .mapStyle(.standard(elevation: .realistic))
                .mapControls {
                    MapCompass()
                }
                .ignoresSafeArea(edges: .top)
                .onChange(of: selectedDiaryId) { _, newValue in
                    withAnimation(AdriftMotion.gentle) {
                        viewModel.selectDiary(id: newValue)
                    }
                }

                mapChromeOverlay
                    .allowsHitTesting(false)

                VStack {
                    MapTopStatusHUD(diaryCount: viewModel.diaries.count)
                        .padding(.top, 10)
                        .padding(.horizontal, 16)
                    Spacer()
                }
                .zIndex(3)

                if viewModel.isLoading {
                    GlassPanel {
                        ProgressView("讀取日記...")
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, 20)
                    .padding(.horizontal)
                    .zIndex(3)
                }

                if !viewModel.isLoading && viewModel.diaries.isEmpty && viewModel.errorMessage == nil {
                    GlassPanel {
                        VStack(spacing: 8) {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.title2)
                                .foregroundStyle(AdriftColors.ocean)
                            Text("還沒有地圖日記")
                                .font(AdriftTypography.section)
                            Text("按下右下角的新增按鈕，在現在的位置留下第一個記憶光點。")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                    }
                    .frame(maxWidth: 288)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, 102)
                    .padding(.horizontal)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                    .zIndex(3)
                }

                VStack {
                    Spacer()
                    HStack(alignment: .bottom) {
                        Spacer()
                        FloatingMapControls(
                            isLocating: viewModel.isLocating,
                            onLocate: {
                                viewModel.recenterOnCurrentLocation()
                            },
                            onAddDiary: {
                                showingAddDiary = true
                            }
                        )
                        .padding(.trailing, 18)
                        .padding(.bottom, viewModel.selectedDiary == nil ? 72 : 228)
                    }
                }
                .zIndex(4)

                if let diary = viewModel.selectedDiary {
                    VStack {
                        Spacer()
                        MapDiaryPreviewCard(
                            diary: diary,
                            onOpen: {
                                detailDiary = diary
                            },
                            onClose: closeSelectedDiary
                        )
                        .padding(.horizontal, 16)
                        .padding(.bottom, 84)
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .zIndex(5)
                }
            }
            .adriftPageNavigation("地圖日記")
            .toolbarBackground(.hidden, for: .navigationBar)
            .overlay(alignment: .top) {
                if let error = viewModel.errorMessage {
                    GlassPanel {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .font(.callout)
                            .foregroundStyle(.red)
                    }
                    .padding(.horizontal, AppPageLayout.horizontalInset)
                    .padding(.top, AppPageLayout.topInset)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .sheet(item: $detailDiary) { diary in
                DiaryDetailView(diary: diary)
                    .presentationDetents([.medium, .large])
                    .presentationBackground(.regularMaterial)
            }
            .sheet(isPresented: $showingAddDiary) {
                AddDiaryView(viewModel: viewModel)
                    .presentationDetents([.large])
                    .presentationBackground(.regularMaterial)
            }
            .task {
                await refreshManager.refreshIfNeeded(scopes: [.diaries])
            }
            .onReceive(viewModel.locationManager.$lastLocation) { location in
                guard let coordinate = location?.coordinate else { return }
                if viewModel.isLocating {
                    viewModel.focusCamera(on: coordinate, distance: 1_200, pitch: 35, animated: true)
                    viewModel.isLocating = false
                    viewModel.lastLocatedAt = Date()
                }
            }
            .onReceive(viewModel.locationManager.$errorMessage) { message in
                guard let message else { return }
                viewModel.isLocating = false
                viewModel.errorMessage = message
            }
            .animation(AdriftMotion.gentle, value: viewModel.diaries.isEmpty)
            .animation(AdriftMotion.gentle, value: viewModel.selectedDiary)
        }
    }

    private func closeSelectedDiary() {
        withAnimation(AdriftMotion.gentle) {
            selectedDiaryId = nil
            viewModel.selectDiary(id: nil)
        }
    }

    private var mapChromeOverlay: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [.black.opacity(0.42), .black.opacity(0.10), .clear],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 150)

            Spacer()

            LinearGradient(
                colors: [.clear, .black.opacity(0.18), .black.opacity(0.44)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 220)
        }
        .ignoresSafeArea()
    }
}

private struct MapTopStatusHUD: View {
    let diaryCount: Int

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AdriftColors.cyan)

            VStack(alignment: .leading, spacing: 1) {
                Text("漂流地圖")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text(diaryCount == 0 ? "附近還沒有日記" : "目前有 \(diaryCount) 則記憶光點")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.68))
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay {
            Capsule()
                .stroke(.white.opacity(0.16), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.20), radius: 16, y: 8)
        .frame(maxWidth: 260)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct UserLocationDotView: View {
    @State private var breathes = false

    var body: some View {
        ZStack {
            Circle()
                .fill(AdriftColors.cyan.opacity(0.18))
                .frame(width: breathes ? 44 : 30, height: breathes ? 44 : 30)
                .blur(radius: 0.5)

            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color(red: 0.20, green: 0.68, blue: 1.0), AdriftColors.cyan],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 17, height: 17)
                .overlay {
                    Circle()
                        .stroke(.white, lineWidth: 3)
                }
                .shadow(color: AdriftColors.cyan.opacity(0.55), radius: 12, y: 2)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 2.6).repeatForever(autoreverses: true)) {
                breathes = true
            }
        }
        .accessibilityLabel("目前位置")
    }
}
