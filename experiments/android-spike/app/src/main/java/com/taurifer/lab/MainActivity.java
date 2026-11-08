package com.taurifer.lab;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.SystemClock;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.OutputStream;
import java.util.UUID;

/** Isolated proof-of-concept Android WebView shell for Taurifer's production PWA. */
public final class MainActivity extends Activity {
    private static final String APP_URL = "https://taurifer.com/";
    private static final int CHOOSE_FILE = 2001;
    private static final int SAVE_EXPORT = 2002;
    private static final int MAX_EXPORT_BASE64 = 16 * 1024 * 1024;

    private FrameLayout frame;
    private WebView webView;
    private LinearLayout errorOverlay;
    private ValueCallback<Uri[]> pendingFileChooser;
    private byte[] pendingExportBytes;
    private String pendingNonce;
    private long nonceCreatedAt;
    private boolean loadFailed;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(244, 242, 239));
        setContentView(frame);
        createErrorOverlay();
        installWebView();
    }

    private boolean trusted(Uri url) {
        if (url == null || !"https".equalsIgnoreCase(url.getScheme())) return false;
        String host = url.getHost();
        return "taurifer.com".equalsIgnoreCase(host)
                || "www.taurifer.com".equalsIgnoreCase(host);
    }

    private void installWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(244, 242, 239));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUserAgentString(settings.getUserAgentString() + " TauriferAndroidLab/0.1");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(false);

        // This interface is available to subframes as well. It accepts only the
        // single-use nonce supplied to our trusted top-level page by exportBlob.
        webView.addJavascriptInterface(new BlobExportBridge(), "TauriferLabBlobExport");
        webView.setWebViewClient(new TrustedWebViewClient());
        webView.setWebChromeClient(new TrustedChromeClient());
        webView.setDownloadListener(new TauriferDownloads());

        frame.addView(webView, 0, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.loadUrl(APP_URL);
    }

    private void createErrorOverlay() {
        errorOverlay = new LinearLayout(this);
        errorOverlay.setOrientation(LinearLayout.VERTICAL);
        errorOverlay.setGravity(Gravity.CENTER);
        errorOverlay.setPadding(dp(28), dp(28), dp(28), dp(28));
        errorOverlay.setBackgroundColor(Color.rgb(244, 242, 239));

        TextView heading = new TextView(this);
        heading.setText("Taurifer couldn't load");
        heading.setTextSize(21);
        heading.setTextColor(Color.rgb(35, 33, 30));
        heading.setGravity(Gravity.CENTER);
        errorOverlay.addView(heading);

        TextView message = new TextView(this);
        message.setText("Connect to the internet for the first launch, then try again.");
        message.setTextSize(15);
        message.setTextColor(Color.rgb(90, 86, 80));
        message.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        messageParams.topMargin = dp(12);
        errorOverlay.addView(message, messageParams);

        Button retry = new Button(this);
        retry.setText("Retry");
        retry.setOnClickListener(v -> {
            errorOverlay.setVisibility(View.GONE);
            webView.loadUrl(APP_URL);
        });
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        buttonParams.topMargin = dp(20);
        errorOverlay.addView(retry, buttonParams);
        errorOverlay.setVisibility(View.GONE);
        frame.addView(errorOverlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private int dp(int pixels) {
        return Math.round(pixels * getResources().getDisplayMetrics().density);
    }

    private void openOutside(Uri url) {
        if (url == null) return;
        String scheme = url.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)
                && !"mailto".equalsIgnoreCase(scheme) && !"tel".equalsIgnoreCase(scheme)) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (Exception ignored) {
            Toast.makeText(this, "No app available to open this link", Toast.LENGTH_SHORT).show();
        }
    }

    private final class TrustedWebViewClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return false;
            Uri target = request.getUrl();
            if (trusted(target) || "about".equalsIgnoreCase(target.getScheme())
                    || "blob".equalsIgnoreCase(target.getScheme())) return false;
            openOutside(target);
            return true;
        }

        @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            loadFailed = false;
        }

        @Override public void onPageFinished(WebView view, String url) {
            if (!loadFailed && errorOverlay != null) errorOverlay.setVisibility(View.GONE);
            if (trusted(Uri.parse(url))) {
                // Taurifer revokes its temporary blob URL immediately after a
                // download click; defer revocation for a short native export handoff.
                view.evaluateJavascript(
                        "(function(){if(window.__tauriferLabBlobPatch)return;" +
                        "window.__tauriferLabBlobPatch=true;" +
                        "var revoke=URL.revokeObjectURL.bind(URL);" +
                        "URL.revokeObjectURL=function(u){" +
                        "if(typeof u==='string'&&u.indexOf('blob:')===0){" +
                        "setTimeout(function(){revoke(u)},15000);return;}" +
                        "return revoke(u);};})()", null);
            }
        }

        @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                loadFailed = true;
                errorOverlay.setVisibility(View.VISIBLE);
            }
        }

        @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
            frame.removeView(view);
            view.destroy();
            webView = null;
            if (pendingFileChooser != null) {
                pendingFileChooser.onReceiveValue(null);
                pendingFileChooser = null;
            }
            pendingNonce = null;
            pendingExportBytes = null;
            installWebView();
            return true;
        }
    }

    private final class TrustedChromeClient extends WebChromeClient {
        @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                     FileChooserParams params) {
            if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
            pendingFileChooser = callback;
            try {
                startActivityForResult(
                        Intent.createChooser(params.createIntent(), "Choose a Taurifer file"),
                        CHOOSE_FILE);
                return true;
            } catch (Exception e) {
                pendingFileChooser.onReceiveValue(null);
                pendingFileChooser = null;
                Toast.makeText(MainActivity.this, "Couldn't open file picker", Toast.LENGTH_SHORT).show();
                return false;
            }
        }

        @Override public boolean onCreateWindow(WebView view, boolean isDialog,
                                                  boolean isUserGesture, android.os.Message resultMsg) {
            if (!isUserGesture) return false;
            WebView popup = new WebView(MainActivity.this);
            popup.setWebViewClient(new WebViewClient() {
                private boolean opened;

                private void handleTarget(WebView child, Uri target) {
                    if (opened || target == null || "about".equalsIgnoreCase(target.getScheme())) return;
                    opened = true;
                    if (trusted(target) && webView != null) webView.loadUrl(target.toString());
                    else openOutside(target);
                    child.post(child::destroy);
                }

                @Override public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                    handleTarget(child, request.getUrl());
                    return true;
                }

                @Override public void onPageStarted(WebView child, String url, android.graphics.Bitmap icon) {
                    handleTarget(child, Uri.parse(url));
                }
            });
            popup.postDelayed(() -> { if (popup.getParent() == null) popup.destroy(); }, 10000);
            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(popup);
            resultMsg.sendToTarget();
            return true;
        }

        @Override public void onPermissionRequest(PermissionRequest request) {
            request.deny();
        }
    }

    private final class TauriferDownloads implements DownloadListener {
        @Override public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                               String mimeType, long contentLength) {
            if (url.startsWith("blob:")) {
                exportBlob(url, contentDisposition, mimeType);
                return;
            }
            Uri uri = Uri.parse(url);
            if (!trusted(uri)) {
                openOutside(uri);
                return;
            }
            try {
                DownloadManager.Request request = new DownloadManager.Request(uri);
                String filename = safeFilename(URLUtil.guessFileName(url, contentDisposition, mimeType));
                request.setTitle(filename);
                request.setMimeType(mimeType == null ? "application/octet-stream" : mimeType);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null && !cookies.isEmpty()) request.addRequestHeader("Cookie", cookies);
                if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);
                DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                manager.enqueue(request);
                Toast.makeText(MainActivity.this, "Saving to Downloads", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "Download failed", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void exportBlob(String blobUrl, String contentDisposition, String mime) {
        if (webView == null || !trusted(Uri.parse(webView.getUrl()))) return;
        if (pendingNonce != null || pendingExportBytes != null) {
            Toast.makeText(this, "Finish the current export first", Toast.LENGTH_SHORT).show();
            return;
        }
        String filename = safeFilename(URLUtil.guessFileName(
                "https://taurifer.com/taurifer-export.json", contentDisposition, mime));
        String nonce = UUID.randomUUID().toString();
        pendingNonce = nonce;
        nonceCreatedAt = SystemClock.elapsedRealtime();

        String script = "(async function(){try{"
                + "const blob=await(await fetch(" + JSONObject.quote(blobUrl) + ")).blob();"
                + "if(blob.size>12000000) return;"
                + "const reader=new FileReader();"
                + "reader.onload=function(){window.TauriferLabBlobExport.save("
                + JSONObject.quote(nonce) + "," + JSONObject.quote(filename) + ","
                + JSONObject.quote(mime == null ? "application/octet-stream" : mime)
                + ",reader.result);};"
                + "reader.readAsDataURL(blob);"
                + "}catch(e){}})();";
        webView.evaluateJavascript(script, null);
        webView.postDelayed(() -> {
            if (nonce.equals(pendingNonce)) {
                pendingNonce = null;
                Toast.makeText(this, "Export timed out. Try again.", Toast.LENGTH_SHORT).show();
            }
        }, 45000);
    }

    private static String safeFilename(String name) {
        String safe = name == null ? "" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        if (safe.isEmpty() || ".".equals(safe) || "..".equals(safe)) safe = "taurifer-export.json";
        return safe.length() > 96 ? safe.substring(safe.length() - 96) : safe;
    }

    private final class BlobExportBridge {
        @JavascriptInterface public void save(String nonce, String filename, String mime, String dataUrl) {
            runOnUiThread(() -> {
                if (pendingNonce == null || !pendingNonce.equals(nonce)
                        || SystemClock.elapsedRealtime() - nonceCreatedAt > 45000
                        || webView == null || !trusted(Uri.parse(webView.getUrl()))) return;
                pendingNonce = null;
                if (dataUrl == null || dataUrl.length() > MAX_EXPORT_BASE64
                        || !dataUrl.startsWith("data:") || !dataUrl.contains(";base64,")) return;
                int comma = dataUrl.indexOf(";base64,") + 8;
                try {
                    byte[] bytes = Base64.decode(dataUrl.substring(comma), Base64.DEFAULT);
                    if (bytes.length > 12_000_000) return;
                    pendingExportBytes = bytes;
                    Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    save.addCategory(Intent.CATEGORY_OPENABLE);
                    save.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    save.putExtra(Intent.EXTRA_TITLE, safeFilename(filename));
                    startActivityForResult(save, SAVE_EXPORT);
                } catch (Exception e) {
                    pendingExportBytes = null;
                    Toast.makeText(MainActivity.this, "Couldn't prepare export", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == CHOOSE_FILE) {
            if (pendingFileChooser != null) {
                pendingFileChooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                pendingFileChooser = null;
            }
            return;
        }
        if (requestCode == SAVE_EXPORT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null
                    && pendingExportBytes != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData(), "w")) {
                    if (output == null) throw new IllegalStateException("No document output");
                    output.write(pendingExportBytes);
                    Toast.makeText(this, "Export saved", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(this, "Couldn't save export", Toast.LENGTH_SHORT).show();
                }
            }
            pendingExportBytes = null;
        }
    }

    @Override public void onBackPressed() {
        if (errorOverlay != null && errorOverlay.getVisibility() == View.VISIBLE) {
            super.onBackPressed();
        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
        CookieManager.getInstance().flush();
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override protected void onDestroy() {
        if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
        pendingFileChooser = null;
        pendingExportBytes = null;
        pendingNonce = null;
        if (webView != null) {
            frame.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
