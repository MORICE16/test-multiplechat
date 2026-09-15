package fr.alan.morice;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public final class MoriceWidgetProvider extends AppWidgetProvider {
    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids) {
        for(int id:ids) {
            RemoteViews views=new RemoteViews(context.getPackageName(),R.layout.morice_widget);
            Intent talk=new Intent(context,VoiceActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent action=PendingIntent.getActivity(context,id,talk,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root,action);
            manager.updateAppWidget(id,views);
        }
    }
}
