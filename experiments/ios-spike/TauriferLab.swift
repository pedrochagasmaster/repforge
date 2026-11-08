import SwiftUI
import WebKit
import UIKit

private enum TauriferLabConfig {
    static let startURL = URL(string: "https://taurifer.com/")!
    static let allowedHosts: Set<String> = ["taurifer.com", "www.taurifer.com"]
}

@MainActor
final class TauriferBrowserState: ObservableObject {
    @Published var loadError: String?
    weak var webView: WKWebView?

    func reload() {
        loadError = nil
        webView?.load(URLRequest(url: TauriferLabConfig.startURL))
    }
}

@main
struct TauriferLabApp: App {
    @StateObject private var browser = TauriferBrowserState()

    var body: some Scene {
        WindowGroup {
            ZStack {
                TauriferWebView(browser: browser).ignoresSafeArea()
                if let message = browser.loadError {
                    VStack(spacing: 16) {
                        Image(systemName: "wifi.exclamationmark").font(.system(size: 40))
                        Text("Taurifer couldn't load").font(.headline)
                        Text(message).multilineTextAlignment(.center)
                        Button("Try again") { browser.reload() }.buttonStyle(.borderedProminent)
                    }
                    .padding(32)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(red: 244 / 255, green: 242 / 255, blue: 239 / 255))
                }
            }
        }
    }
}

struct TauriferWebView: UIViewRepresentable {
    @ObservedObject var browser: TauriferBrowserState

    func makeCoordinator() -> Coordinator { Coordinator(browser: browser) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.allowsInlineMediaPlayback = true
        config.applicationNameForUserAgent = "TauriferLab/0.1"
        config.userContentController.addUserScript(WKUserScript(
            source: "try { localStorage.setItem('repforge_telemetry_enabled_v1', 'false'); } catch (e) {}",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.isInspectable = true
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.allowsBackForwardNavigationGestures = false
        view.allowsLinkPreview = false
        view.isOpaque = false
        view.backgroundColor = UIColor(red: 244 / 255, green: 242 / 255, blue: 239 / 255, alpha: 1)
        view.scrollView.backgroundColor = view.backgroundColor
        browser.webView = view
        view.load(URLRequest(url: TauriferLabConfig.startURL))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Don't reload on view updates during an active workout.
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
        private let browser: TauriferBrowserState
        private var downloads: [ObjectIdentifier: URL] = [:]

        init(browser: TauriferBrowserState) { self.browser = browser }

        private func isInternal(_ url: URL) -> Bool {
            url.scheme?.lowercased() == "https" &&
                TauriferLabConfig.allowedHosts.contains(url.host?.lowercased() ?? "")
        }

        func webView(_ webView: WKWebView,
                     decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if action.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
            guard let url = action.request.url else {
                decisionHandler(.cancel)
                return
            }
            if isInternal(url) || url.scheme == "about" || url.scheme == "blob" {
                decisionHandler(.allow)
                return
            }
            if ["https", "http", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView,
                     decidePolicyFor response: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            decisionHandler(response.canShowMIMEType ? .allow : .download)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            browser.loadError = nil
        }

        func webView(_ webView: WKWebView,
                     didFailProvisionalNavigation navigation: WKNavigation!,
                     withError error: Error) {
            if (error as NSError).code != NSURLErrorCancelled {
                browser.loadError = "An internet connection is required for the initial load."
            }
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            guard let url = action.request.url else { return nil }
            if isInternal(url) {
                webView.load(URLRequest(url: url))
            } else if ["https", "http", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
            }
            return nil
        }

        func webView(_ webView: WKWebView,
                     navigationAction: WKNavigationAction,
                     didBecome download: WKDownload) { download.delegate = self }

        func webView(_ webView: WKWebView,
                     navigationResponse: WKNavigationResponse,
                     didBecome download: WKDownload) { download.delegate = self }

        func download(_ download: WKDownload,
                      decideDestinationUsing response: URLResponse,
                      suggestedFilename: String,
                      completionHandler: @escaping (URL?) -> Void) {
            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let filename = (suggestedFilename as NSString).lastPathComponent
                let destination = directory.appendingPathComponent(filename.isEmpty ? "taurifer-export.json" : filename)
                downloads[ObjectIdentifier(download)] = destination
                completionHandler(destination)
            } catch { completionHandler(nil) }
        }

        func downloadDidFinish(_ download: WKDownload) {
            guard let destination = downloads.removeValue(forKey: ObjectIdentifier(download)),
                  FileManager.default.fileExists(atPath: destination.path),
                  let controller = topController() else { return }
            let share = UIActivityViewController(activityItems: [destination], applicationActivities: nil)
            share.popoverPresentationController?.sourceView = controller.view
            controller.present(share, animated: true)
        }

        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            downloads.removeValue(forKey: ObjectIdentifier(download))
        }

        func webView(_ webView: WKWebView,
                     runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: "Taurifer", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            guard let controller = topController() else { completionHandler(); return }
            controller.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView,
                     runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: "Taurifer", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            guard let controller = topController() else { completionHandler(false); return }
            controller.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView,
                     runJavaScriptTextInputPanelWithPrompt prompt: String,
                     defaultText: String?,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (String?) -> Void) {
            let alert = UIAlertController(title: "Taurifer", message: prompt, preferredStyle: .alert)
            alert.addTextField { $0.text = defaultText }
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                completionHandler(alert.textFields?.first?.text)
            })
            guard let controller = topController() else { completionHandler(nil); return }
            controller.present(alert, animated: true)
        }

        private func topController() -> UIViewController? {
            let windows = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
            var controller = windows.first(where: \.isKeyWindow)?.rootViewController
            while let presented = controller?.presentedViewController { controller = presented }
            return controller
        }
    }
}
