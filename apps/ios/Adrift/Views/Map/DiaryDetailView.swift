import SwiftUI

struct DiaryDetailView: View {
    let diary: Diary

    var body: some View {
        AppPageScrollContainer {
            DiaryCard(diary: diary)
        }
        .adriftPageNavigation("日記詳情")
    }
}
