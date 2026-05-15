package com.example.spaceinvaders.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/scores")
public class ScoreController {

    private static final int MAX_SCORES = 10;
    private final List<ScoreEntry> scores = new CopyOnWriteArrayList<>();

    @GetMapping
    public List<ScoreEntry> getScores() {
        List<ScoreEntry> sorted = new ArrayList<>(scores);
        sorted.sort(Comparator.comparingInt(ScoreEntry::score).reversed());
        return sorted;
    }

    @PostMapping
    public List<ScoreEntry> addScore(@RequestBody ScoreEntry entry) {
        String name = entry.name() == null || entry.name().isBlank() ? "AAA" : entry.name();
        if (name.length() > 12) {
            name = name.substring(0, 12);
        }
        scores.add(new ScoreEntry(name, Math.max(0, entry.score()), System.currentTimeMillis()));

        List<ScoreEntry> sorted = new ArrayList<>(scores);
        sorted.sort(Comparator.comparingInt(ScoreEntry::score).reversed());
        if (sorted.size() > MAX_SCORES) {
            scores.clear();
            scores.addAll(sorted.subList(0, MAX_SCORES));
            return scores.stream()
                    .sorted(Comparator.comparingInt(ScoreEntry::score).reversed())
                    .toList();
        }
        return sorted;
    }

    public record ScoreEntry(String name, int score, long timestamp) {
        public ScoreEntry(String name, int score) {
            this(name, score, System.currentTimeMillis());
        }
    }
}
