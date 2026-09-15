package fr.alan.morice;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.graphics.Color;
import android.net.Uri;
import android.widget.Toast;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;

final class MoriceBrowser {
    static void open(Activity activity, String draft) {
        Uri.Builder address = Uri.parse("https://morice-alan-assistant.alan-nhl-99.chatgpt.site/").buildUpon().appendQueryParameter("view", "chat");
        if (draft != null) address.encodedFragment("morice-draft=" + Uri.encode(draft));
        CustomTabsIntent tab = new CustomTabsIntent.Builder()
            .setColorScheme(CustomTabsIntent.COLOR_SCHEME_LIGHT)
            .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder()
                .setToolbarColor(Color.rgb(243,247,252)).setNavigationBarColor(Color.rgb(243,247,252)).build())
            .setShowTitle(false).setUrlBarHidingEnabled(true).build();
        try {
            tab.launchUrl(activity, address.build());
        } catch (ActivityNotFoundException error) {
            Toast.makeText(activity, "Un navigateur compatible est nécessaire pour ouvrir Morice.", Toast.LENGTH_LONG).show();
        }
    }
}
