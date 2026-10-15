package ar.fcv.unidadvet;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.CalendarContract;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {

    /**
     * Las páginas de assets/ se sirven bajo este dominio https virtual (no sale a
     * internet): así la app tiene un origen seguro estable para IndexedDB,
     * localStorage y crypto.randomUUID().
     */
    private static final String HOST = "appassets.androidplatform.net";
    private static final String BASE_URL = "https://" + HOST + "/";
    private static final int REQUEST_FILE = 1001;

    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html");
        MIME.put("js", "application/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("png", "image/png");
        MIME.put("svg", "image/svg+xml");
    }

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!HOST.equals(uri.getHost())) return null;
                return serveAsset(uri.getPath());
            }

            // Cualquier enlace que no sea de la app (WhatsApp, Google...) se abre afuera.
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) return false;
                startExternal(new Intent(Intent.ACTION_VIEW, uri), null);
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            // Selector de archivos para los <input type="file"> (adjuntos, importar copia).
            // Tener un WebChromeClient también habilita los diálogos confirm()/alert().
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    }
                    startActivityForResult(intent, REQUEST_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(webView);
        String desdeAviso = getIntent().getStringExtra("url");
        if (desdeAviso != null && !desdeAviso.isEmpty()) {
            webView.loadUrl(BASE_URL + desdeAviso);
        } else if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(BASE_URL + "index.html");
        }
    }

    // Al tocar un aviso con la app abierta: ir a la hoja de ese internado.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String url = intent.getStringExtra("url");
        if (url != null && !url.isEmpty()) webView.loadUrl(BASE_URL + url);
    }

    private WebResourceResponse serveAsset(String path) {
        if (path == null || path.equals("/")) path = "/index.html";
        String file = path.substring(1);
        String ext = file.contains(".") ? file.substring(file.lastIndexOf('.') + 1) : "";
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
        try {
            InputStream in = getAssets().open(file);
            return new WebResourceResponse(mime, "UTF-8", in);
        } catch (IOException e) {
            WebResourceResponse notFound = new WebResourceResponse("text/plain", "UTF-8", null);
            notFound.setStatusCodeAndReasonPhrase(404, "Not Found");
            return notFound;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_FILE && fileCallback != null) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            if (resultCode == RESULT_OK && data != null && data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                result = new Uri[n];
                for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // La página decide si maneja el "atrás" (volver / cerrar modal) o si se cierra la app.
        webView.evaluateJavascript("window.appBack ? window.appBack() : false", value -> {
            if (!"true".equals(value)) {
                MainActivity.super.onBackPressed();
            }
        });
    }

    /** Abre otra app (navegador, WhatsApp, calendario, visor de PDF) desde el hilo de UI. */
    private void startExternal(Intent intent, String errorMessage) {
        runOnUiThread(() -> {
            try {
                startActivity(intent);
            } catch (ActivityNotFoundException e) {
                if (errorMessage != null) Toast.makeText(this, errorMessage, Toast.LENGTH_LONG).show();
            }
        });
    }

    /** Funciones nativas expuestas a JavaScript como window.AndroidBridge (ver assets/apk.js). */
    private class Bridge {

        /** Guarda un archivo (base64) en Descargas; los PDF además se abren. Devuelve un mensaje. */
        @JavascriptInterface
        public String saveFile(String base64, String fileName, String mime) {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver resolver = getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mime);
                    values.put(MediaStore.Downloads.IS_PENDING, 1);
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) return "No se pudo crear el archivo";
                    try (OutputStream os = resolver.openOutputStream(uri)) {
                        os.write(data);
                    }
                    values.clear();
                    values.put(MediaStore.Downloads.IS_PENDING, 0);
                    resolver.update(uri, values, null, null);
                    if ("application/pdf".equals(mime)) {
                        Intent view = new Intent(Intent.ACTION_VIEW)
                                .setDataAndType(uri, mime)
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startExternal(view, null); // sin visor de PDF el archivo igual queda guardado
                    }
                    return "Guardado en Descargas";
                }
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                File file = new File(dir, fileName);
                try (FileOutputStream os = new FileOutputStream(file)) {
                    os.write(data);
                }
                return "Guardado en " + file.getAbsolutePath();
            } catch (Exception e) {
                return "No se pudo guardar: " + e.getMessage();
            }
        }

        /**
         * Comparte uno o varios archivos. files = JSON [{name, mime, base64}].
         * Si toDrive es true intenta abrir directamente "Guardar en Drive"; si Drive
         * no está instalado, muestra el selector de apps.
         */
        @JavascriptInterface
        public String shareFiles(String filesJson, String title, boolean toDrive) {
            try {
                File dir = ShareProvider.dir(MainActivity.this);
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) f.delete();
                JSONArray arr = new JSONArray(filesJson);
                ArrayList<Uri> uris = new ArrayList<>();
                ClipData clip = null;
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    String name = o.getString("name").replaceAll("[\\\\/:*?\"<>|]", "_");
                    File f = new File(dir, name);
                    try (FileOutputStream os = new FileOutputStream(f)) {
                        os.write(Base64.decode(o.getString("base64"), Base64.DEFAULT));
                    }
                    Uri u = ShareProvider.uriFor(MainActivity.this, f);
                    uris.add(u);
                    if (clip == null) clip = ClipData.newRawUri(name, u);
                    else clip.addItem(new ClipData.Item(u));
                }
                if (uris.isEmpty()) return "No hay archivos para compartir";
                Intent send;
                if (uris.size() == 1) {
                    send = new Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris.get(0));
                } else {
                    send = new Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
                }
                send.setType(uris.size() == 1 ? arr.getJSONObject(0).getString("mime") : "*/*");
                send.putExtra(Intent.EXTRA_SUBJECT, title);
                send.setClipData(clip);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                final Intent chooser = Intent.createChooser(send, title);
                final Intent drive = new Intent(send).setPackage("com.google.android.apps.docs");
                runOnUiThread(() -> {
                    try {
                        startActivity(toDrive ? drive : chooser);
                    } catch (ActivityNotFoundException e) {
                        try {
                            startActivity(chooser);
                        } catch (ActivityNotFoundException ignored) {
                            Toast.makeText(MainActivity.this, "No hay apps para compartir", Toast.LENGTH_LONG).show();
                        }
                    }
                });
                return toDrive ? "Abriendo Google Drive: elegí la carpeta y tocá Guardar" : "Elegí dónde compartir";
            } catch (Exception e) {
                return "No se pudo compartir: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String scheduleAlarms(String json) {
            int n = AlarmReceiver.schedule(MainActivity.this, json);
            return n + " aviso(s) programado(s)";
        }

        @JavascriptInterface
        public void requestNotifications() {
            runOnUiThread(() -> {
                AlarmReceiver.createChannel(MainActivity.this);
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 2001);
                }
            });
        }

        @JavascriptInterface
        public void openUrl(String url) {
            startExternal(new Intent(Intent.ACTION_VIEW, Uri.parse(url)), "No hay una app para abrir este enlace");
        }

        /** Abre el calendario del celular con el evento precargado (el usuario confirma y guarda). */
        @JavascriptInterface
        public String addCalendarEvent(String title, String description, double beginMillis, double endMillis, boolean allDay) {
            Intent intent = new Intent(Intent.ACTION_INSERT)
                    .setData(CalendarContract.Events.CONTENT_URI)
                    .putExtra(CalendarContract.Events.TITLE, title)
                    .putExtra(CalendarContract.Events.DESCRIPTION, description)
                    .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, (long) beginMillis)
                    .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, (long) endMillis)
                    .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, allDay);
            startExternal(intent, "No se encontró una app de calendario");
            return "Abriendo el calendario: confirmá el evento para guardarlo";
        }
    }
}
