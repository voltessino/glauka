package it.neuromap.architect.preview;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/** Native dialog messages: independent of a crashed/unresponsive WebView. */
final class AndroidNativeMessages {
    private static final String[] KEYS = {
        "recoverTitle","rendererLost","loadFailed","retry","close","exportTitle",
        "exportPending","exportCorrupt","later","discard","exportSaved",
        "exportWriteFailed","backTitle","backBody","exit","stay","repeatedCrash"
    };
    private static final Map<String, Map<String, String>> TEXT;
    static {
        Map<String, Map<String, String>> table = new HashMap<>();
        put(table, "it",
            "Ripristino Glauka", "La WebView si è interrotta. Riaprendo l'editor verrà recuperata l'ultima copia disponibile.",
            "Non è stato possibile caricare l'editor. Riprova senza eliminare i progetti.",
            "Riprova", "Chiudi", "Salvataggio sospeso",
            "È presente un'esportazione preparata prima dell'interruzione. Puoi scegliere una cartella e salvarla ora.",
            "Il file temporaneo non supera la verifica d'integrità. Nessun progetto verrà eliminato automaticamente.",
            "Dopo", "Elimina copia", "File salvato sul telefono", "Scrittura fallita. La copia temporanea è stata conservata.",
            "Chiusura di Glauka", "L'editor non ha risposto. Vuoi uscire comunque? Le modifiche non salvate potrebbero andare perse.",
            "Esci comunque", "Resta", "Android System WebView si è interrotto più volte.");
        put(table, "en",
            "Glauka recovery", "The WebView renderer stopped. Reopening the editor will restore the latest available recovery copy.",
            "The editor could not load. Retry without deleting your projects.",
            "Try again", "Close", "Unfinished export",
            "An export was prepared before the interruption. Choose a folder to save it now.",
            "The temporary file failed its integrity check. No projects will be deleted automatically.",
            "Later", "Discard copy", "File saved on your device", "Write failed. The temporary copy was preserved.",
            "Close Glauka", "The editor did not respond. Quit anyway? Unsaved changes might be lost.",
            "Quit anyway", "Stay", "Android System WebView has stopped repeatedly.");
        put(table, "de",
            "Glauka-Wiederherstellung", "WebView wurde beendet. Beim Neustart wird die letzte verfügbare Sicherung geladen.",
            "Der Editor konnte nicht geladen werden. Erneut versuchen, ohne Projekte zu löschen.",
            "Erneut versuchen", "Schließen", "Unterbrochener Export",
            "Ein Export wurde vorbereitet. Wählen Sie einen Ordner, um ihn jetzt zu speichern.",
            "Die temporäre Datei ist beschädigt. Projekte werden nicht automatisch gelöscht.",
            "Später", "Kopie verwerfen", "Datei gespeichert", "Schreiben fehlgeschlagen. Die temporäre Kopie bleibt erhalten.",
            "Glauka schließen", "Der Editor antwortet nicht. Trotzdem schließen? Ungespeicherte Änderungen können verloren gehen.",
            "Trotzdem schließen", "Bleiben", "Android System WebView wurde mehrfach beendet.");
        put(table, "es",
            "Recuperación de Glauka", "WebView se detuvo. Al reabrir el editor se restaurará la última copia disponible.",
            "No se pudo cargar el editor. Reintenta sin eliminar los proyectos.",
            "Reintentar", "Cerrar", "Exportación pendiente",
            "Hay una exportación preparada. Elige una carpeta para guardarla ahora.",
            "El archivo temporal no supera la comprobación. No se borrarán proyectos automáticamente.",
            "Después", "Descartar copia", "Archivo guardado", "Error al escribir. Se conservó la copia temporal.",
            "Cerrar Glauka", "El editor no responde. ¿Salir igualmente? Pueden perderse cambios sin guardar.",
            "Salir", "Permanecer", "Android System WebView se ha detenido varias veces.");
        put(table, "fr",
            "Récupération Glauka", "WebView s'est arrêté. La réouverture restaurera la dernière sauvegarde disponible.",
            "Impossible de charger l'éditeur. Réessayez sans supprimer les projets.",
            "Réessayer", "Fermer", "Export en attente",
            "Un export a été préparé. Choisissez un dossier pour l'enregistrer.",
            "Le fichier temporaire a échoué au contrôle d'intégrité. Aucun projet ne sera supprimé automatiquement.",
            "Plus tard", "Supprimer la copie", "Fichier enregistré", "Écriture échouée. La copie temporaire a été conservée.",
            "Fermer Glauka", "L'éditeur ne répond pas. Quitter quand même ? Des modifications pourraient être perdues.",
            "Quitter", "Rester", "Android System WebView s'est arrêté plusieurs fois.");
        put(table, "pt",
            "Recuperação Glauka", "O WebView parou. Ao reabrir, será restaurada a última cópia disponível.",
            "Não foi possível carregar o editor. Tente novamente sem apagar projetos.",
            "Tentar novamente", "Fechar", "Exportação pendente",
            "Uma exportação foi preparada. Escolha uma pasta para guardá-la agora.",
            "O ficheiro temporário falhou a verificação de integridade. Nenhum projeto será apagado automaticamente.",
            "Mais tarde", "Eliminar cópia", "Ficheiro guardado", "Falha ao guardar. A cópia temporária foi preservada.",
            "Fechar Glauka", "O editor não responde. Sair mesmo assim? Alterações não guardadas podem perder-se.",
            "Sair mesmo assim", "Ficar", "O Android System WebView parou várias vezes.");
        put(table, "ar",
            "استرداد Glauka", "توقّف WebView. ستتم استعادة آخر نسخة متاحة عند إعادة فتح المحرر.",
            "تعذّر تحميل المحرر. أعد المحاولة دون حذف المشاريع.",
            "إعادة المحاولة", "إغلاق", "تصدير غير مكتمل",
            "هناك تصدير جاهز. اختر مجلدًا لحفظه الآن.",
            "فشل التحقق من سلامة الملف المؤقت. لن تُحذف أي مشاريع تلقائيًا.",
            "لاحقًا", "حذف النسخة", "تم حفظ الملف", "فشلت الكتابة. تم الاحتفاظ بالنسخة المؤقتة.",
            "إغلاق Glauka", "لا يستجيب المحرر. هل تريد الخروج؟ قد تضيع التعديلات غير المحفوظة.",
            "الخروج", "البقاء", "توقّف Android System WebView مرارًا.");
        put(table, "zh-CN",
            "Glauka 恢复", "WebView 已停止。重新打开编辑器将恢复最新的可用备份。",
            "编辑器加载失败。请重试，不会删除您的项目。",
            "重试", "关闭", "待完成的导出",
            "中断前已准备好导出文件。现在可以选择文件夹保存。",
            "临时文件完整性检查失败。不会自动删除任何项目。",
            "稍后", "删除副本", "文件已保存", "写入失败。临时副本已保留。",
            "关闭 Glauka", "编辑器无响应。仍要退出吗？未保存的更改可能丢失。",
            "仍要退出", "留在应用", "Android System WebView 已多次停止。");
        TEXT = Collections.unmodifiableMap(table);
    }
    private static void put(Map<String, Map<String, String>> table, String locale, String... values) {
        if (values.length != KEYS.length) throw new IllegalArgumentException("Incomplete Android locale " + locale);
        Map<String, String> entries = new HashMap<>();
        for (int i = 0; i < KEYS.length; i++) entries.put(KEYS[i], values[i]);
        table.put(locale, Collections.unmodifiableMap(entries));
    }
    static String text(String locale, String key) {
        Map<String, String> messages = TEXT.get(locale);
        if (messages == null) messages = TEXT.get("en");
        String answer = messages.get(key);
        if (answer == null) throw new IllegalArgumentException("Unknown native message " + key);
        return answer;
    }
    static int languages() { return TEXT.size(); }
}
