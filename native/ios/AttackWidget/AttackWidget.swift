import WidgetKit
import SwiftUI

// Reads the JSON snapshot the app writes to the App Group (see plugins/widget-bridge). All strings arrive pre-localised.
// Tapping any family opens the app through the deep link: fodmara://episode/new starts a spike immediately.
struct Data: Decodable { let cta: String; let open: Bool; let line1: String; let line2: String; let url: String; let updatedAt: String }
struct Entry: TimelineEntry { let date: Date; let data: Data? }

struct Provider: TimelineProvider {
    static let group = "group.com.ilumie.fodmara"
    func load() -> Data? {
        guard let s = UserDefaults(suiteName: Provider.group)?.string(forKey: "widgetData"), let d = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Data.self, from: d)
    }
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), data: Data(cta: "Louder now", open: false, line1: "Today: 3/10", line2: "7-day avg. 3.4 · 2 spikes", url: "fodmara://episode/new", updatedAt: "")) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: Date(), data: load() ?? placeholder(in: context).data)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let next = Calendar.current.date(byAdding: .hour, value: 6, to: Date())!
        completion(Timeline(entries: [Entry(date: Date(), data: load())], policy: .after(next)))
    }
}

let amber = Color(red: 0.97, green: 0.74, blue: 0.33)
let amberDark = Color(red: 0.85, green: 0.48, blue: 0.16)
let ink = Color(red: 0.18, green: 0.23, blue: 0.33)

/// Tone mark: a dot (the ear canal) and a high-pitched wave growing out of it – same as the app icon.
struct Waves: View {
    var size: CGFloat
    var color: Color = .white
    var body: some View {
        ZStack(alignment: .leading) {
            Tone().stroke(color, style: StrokeStyle(lineWidth: size * 0.065, lineCap: .round, lineJoin: .round))
            Circle().fill(color).frame(width: size * 0.18, height: size * 0.18).offset(x: size * 0.07)
        }.frame(width: size, height: size)
    }
}

struct Tone: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        for i in 0...60 {
            let t = CGFloat(i)
            let x = r.minX + r.width * (0.22 + t * 0.0125)
            let amp = r.height * (0.02 + t * 0.0032)
            let y = r.midY + amp * CGFloat(sin(Double(t) / 2.2))
            if i == 0 { p.move(to: CGPoint(x: x, y: y)) } else { p.addLine(to: CGPoint(x: x, y: y)) }
        }
        return p
    }
}

struct SmallView: View {
    let data: Data?
    var body: some View {
        ZStack {
            ContainerRelativeShape().fill(LinearGradient(colors: data?.open == true ? [ink, ink] : [amber, amberDark], startPoint: .topLeading, endPoint: .bottomTrailing))
            VStack(spacing: 8) {
                Waves(size: 54)
                Text(data?.cta ?? "Louder now").font(.system(.headline, design: .serif)).foregroundColor(.white).multilineTextAlignment(.center).lineLimit(2)
            }.padding(12)
        }
    }
}

struct MediumView: View {
    let data: Data?
    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 22).fill(LinearGradient(colors: data?.open == true ? [ink, ink] : [amber, amberDark], startPoint: .topLeading, endPoint: .bottomTrailing))
                VStack(spacing: 6) { Waves(size: 44); Text(data?.cta ?? "Louder now").font(.system(.subheadline, design: .serif).weight(.medium)).foregroundColor(.white).multilineTextAlignment(.center).lineLimit(2) }.padding(8)
            }.frame(width: 120)
            VStack(alignment: .leading, spacing: 6) {
                Text("Fodmara").font(.system(.headline, design: .serif))
                Text(data?.line1 ?? "").font(.footnote.weight(.semibold)).lineLimit(2)
                Text(data?.line2 ?? "").font(.caption).foregroundColor(.secondary).lineLimit(2)
                Spacer(minLength: 0)
            }
            Spacer(minLength: 0)
        }.padding(14)
    }
}

struct LockRectView: View {
    let data: Data?
    var body: some View {
        HStack(spacing: 8) {
            Waves(size: 28, color: .primary)
            VStack(alignment: .leading, spacing: 1) {
                Text(data?.cta ?? "Louder now").font(.headline).lineLimit(1)
                Text(data?.line1 ?? "").font(.caption2).foregroundColor(.secondary).lineLimit(1)
            }
        }
    }
}

struct LockCircleView: View {
    var body: some View { ZStack { AccessoryWidgetBackground(); Waves(size: 30, color: .primary) } }
}

struct AttackEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry
    var body: some View {
        switch family {
        case .systemSmall: SmallView(data: entry.data)
        case .accessoryRectangular: LockRectView(data: entry.data)
        case .accessoryCircular: LockCircleView()
        default: MediumView(data: entry.data)
        }
    }
}

@main
struct AttackWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AttackWidget", provider: Provider()) { entry in
            let view = AttackEntryView(entry: entry).widgetURL(URL(string: entry.data?.url ?? "fodmara://episode/new"))
            if #available(iOS 17.0, *) { view.containerBackground(.background, for: .widget) } else { view }
        }
        .configurationDisplayName("Fodmara")
        .description("Log a tinnitus spike with one tap.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
        .contentMarginsDisabled()
    }
}
