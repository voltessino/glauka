package it.neuromap.architect.preview;

import java.util.concurrent.Semaphore;

/** Native-only admission gate for AI requests. Independent of Android UI. */
final class AndroidAiJobLimiter {
    private final Semaphore permits;

    AndroidAiJobLimiter(int maximum) {
        if (maximum<1 || maximum>32)
            throw new IllegalArgumentException("Invalid AI concurrency limit");
        permits=new Semaphore(maximum);
    }

    boolean tryStart() { return permits.tryAcquire(); }
    void finish() { permits.release(); }
}
