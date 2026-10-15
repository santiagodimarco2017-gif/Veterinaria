package ar.fcv.unidadvet;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Avisos de la hoja de internación: programa alarmas para cada dosis y
 * muestra la notificación cuando llega la hora. También reprograma al
 * reiniciar el celular (las alarmas se pierden con el reinicio).
 */
public class AlarmReceiver extends BroadcastReceiver {

    static final String CHANNEL = "internacion";
    static final String ACTION = "ar.fcv.unidadvet.AVISO";
    private static final String PREFS = "avisos";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || "android.intent.action.MY_PACKAGE_REPLACED".equals(action)) {
            String json = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("lista", "[]");
            schedule(ctx, json);
            return;
        }
        if (!ACTION.equals(action)) return;
        createChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class)
                .putExtra("url", intent.getStringExtra("url"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int id = intent.getIntExtra("id", 0);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_notif)
                .setContentTitle(intent.getStringExtra("title"))
                .setContentText(intent.getStringExtra("text"))
                .setStyle(new Notification.BigTextStyle().bigText(intent.getStringExtra("text")))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setCategory(Notification.CATEGORY_REMINDER);
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            nm.notify(id, b.build());
        } catch (SecurityException ignored) {
            // Sin permiso de notificaciones.
        }
    }

    static void createChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Internación: medicaciones", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Avisos de cada dosis programada en la hoja de internación");
        ch.enableVibration(true);
        ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        nm.createNotificationChannel(ch);
    }

    private static PendingIntent pending(Context ctx, int id, JSONObject o) {
        Intent i = new Intent(ctx, AlarmReceiver.class).setAction(ACTION).putExtra("id", id);
        if (o != null) {
            i.putExtra("title", o.optString("title")).putExtra("text", o.optString("text")).putExtra("url", o.optString("url"));
        }
        return PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Cancela los avisos anteriores y programa los de la lista (JSON). Devuelve la cantidad programada. */
    static int schedule(Context ctx, String json) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        try {
            JSONArray prev = new JSONArray(sp.getString("ids", "[]"));
            for (int k = 0; k < prev.length(); k++) am.cancel(pending(ctx, prev.getInt(k), null));
        } catch (Exception ignored) {
        }
        JSONArray ids = new JSONArray();
        int n = 0;
        try {
            JSONArray arr = new JSONArray(json);
            long now = System.currentTimeMillis();
            boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
            for (int k = 0; k < arr.length(); k++) {
                JSONObject o = arr.getJSONObject(k);
                long at = o.getLong("at");
                if (at <= now) continue;
                int id = o.getString("key").hashCode();
                PendingIntent pi = pending(ctx, id, o);
                if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                ids.put(id);
                n++;
            }
        } catch (Exception ignored) {
        }
        sp.edit().putString("ids", ids.toString()).putString("lista", json).apply();
        return n;
    }
}
