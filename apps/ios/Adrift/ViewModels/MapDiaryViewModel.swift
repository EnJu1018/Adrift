import CoreLocation
import Foundation
import MapKit
import SwiftUI

@MainActor
final class MapDiaryViewModel: ObservableObject {
    @Published var diaries: [Diary] = []
    @Published var selectedDiary: Diary?
    @Published var isLoading = false
    @Published var isCreating = false
    @Published var isLocating = false
    @Published var errorMessage: String?
    @Published var cameraPosition: MapCameraPosition = .automatic
    @Published var lastLocatedAt: Date?

    let locationManager = LocationManager()

    private let diaryService: DiaryService
    private var isRefreshing = false

    init(diaryService: DiaryService = DiaryService()) {
        self.diaryService = diaryService
    }

    func prepareLocation() {
        locationManager.requestAuthorization()
    }

    func loadDiaries(silently: Bool = false) async {
        guard !isRefreshing else { return }
        isRefreshing = true
        let showsInitialLoading = diaries.isEmpty && !silently
        if showsInitialLoading {
            isLoading = true
            errorMessage = nil
        }

        defer {
            isRefreshing = false
            if showsInitialLoading {
                isLoading = false
            }
        }

        do {
            let nextDiaries = try await diaryService.fetchDiaries()
            let shouldSetInitialCamera = diaries.isEmpty
            diaries = nextDiaries
            errorMessage = nil

            if shouldSetInitialCamera {
                if let coordinate = locationManager.lastLocation?.coordinate {
                    focusCamera(on: coordinate, distance: 1_600, pitch: 30, animated: false)
                } else if let first = diaries.compactMap(\.coordinate).first {
                    focusCamera(on: first, distance: 2_800, pitch: 18, animated: false)
                }
            }
        } catch {
            if !silently || diaries.isEmpty {
                errorMessage = error.localizedDescription
            }
        }
    }

    func selectDiary(id: String?) {
        guard let id else {
            selectedDiary = nil
            return
        }
        selectedDiary = diaries.first { $0.id == id }
    }

    func recenterOnCurrentLocation() {
        locationManager.requestAuthorization()
        isLocating = true

        if let coordinate = locationManager.lastLocation?.coordinate {
            focusCamera(on: coordinate, distance: 1_200, pitch: 35, animated: true)
            isLocating = false
            lastLocatedAt = Date()
        }
    }

    func focusCamera(
        on coordinate: CLLocationCoordinate2D,
        distance: CLLocationDistance = 1_200,
        pitch: CGFloat = 35,
        animated: Bool = true
    ) {
        let camera = MapCamera(
            centerCoordinate: coordinate,
            distance: distance,
            heading: 0,
            pitch: pitch
        )

        if animated {
            withAnimation(.smooth(duration: 0.85)) {
                cameraPosition = .camera(camera)
            }
        } else {
            cameraPosition = .camera(camera)
        }
    }

    func createDiary(
        title: String,
        text: String,
        mood: MoodKind,
        intensity: Int,
        visibility: DiaryVisibility,
        placeName: String,
        imageData: Data?,
        imageMimeType: String?
    ) async -> Bool {
        guard let coordinate = locationManager.lastLocation?.coordinate else {
            errorMessage = "請先允許定位，才能在真實地點留下日記。"
            return false
        }

        isCreating = true
        errorMessage = nil
        do {
            let diary = try await diaryService.createDiary(
                CreateDiaryRequest(
                    title: title,
                    text: text,
                    mood: mood,
                    intensity: intensity,
                    visibility: visibility,
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude,
                    placeName: placeName,
                    imageData: imageData,
                    imageMimeType: imageMimeType
                )
            )
            diaries.insert(diary, at: 0)
            selectedDiary = diary
            isCreating = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isCreating = false
            return false
        }
    }
}
