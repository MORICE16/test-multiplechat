package fr.alan.morice;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.widget.Toast;
import java.util.ArrayList;

/** A deliberate widget tap opens Android dictation. Never sends a command automatically. */
public final class VoiceActivity extends Activity {
    private static final int DICTATE=41;
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        if(state!=null) return;
        Intent request=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        request.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        request.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"fr-FR");
        request.putExtra(RecognizerIntent.EXTRA_PROMPT,"Que souhaites-tu demander à Morice ?");
        request.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
        try { startActivityForResult(request,DICTATE); }
        catch(ActivityNotFoundException error) {
            Toast.makeText(this,"La dictée Android est indisponible. Utilise le micro de Morice ou le clavier.",Toast.LENGTH_LONG).show();
            MoriceBrowser.open(this,null);
            finish();
        }
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode!=DICTATE) return;
        if(resultCode==RESULT_OK && data!=null) {
            ArrayList<String> matches=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if(matches!=null && !matches.isEmpty() && !matches.get(0).trim().isEmpty()) MoriceBrowser.open(this,matches.get(0));
        }
        finish();
    }
}
