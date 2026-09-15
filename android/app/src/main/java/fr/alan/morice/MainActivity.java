package fr.alan.morice;
import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.view.WindowInsets;
import android.widget.Toast;

public final class MainActivity extends Activity {
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        findViewById(R.id.main_root).setOnApplyWindowInsetsListener((view,insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        findViewById(R.id.talk_button).setOnClickListener(v -> startActivity(new Intent(this,VoiceActivity.class)));
        findViewById(R.id.open_button).setOnClickListener(v -> MoriceBrowser.open(this,null));
        findViewById(R.id.widget_button).setOnClickListener(v -> {
            AppWidgetManager manager=AppWidgetManager.getInstance(this);
            if(manager.isRequestPinAppWidgetSupported()) {
                manager.requestPinAppWidget(new ComponentName(this,MoriceWidgetProvider.class),null,null);
            } else {
                Toast.makeText(this,"Maintiens un espace vide de l’accueil, puis Widgets → Morice.",Toast.LENGTH_LONG).show();
            }
        });
    }
}
