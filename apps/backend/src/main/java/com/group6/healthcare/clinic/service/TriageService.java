package com.group6.healthcare.clinic.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.healthcare.clinic.dto.TriageRequest;
import com.group6.healthcare.clinic.dto.TriageResponse;
import com.group6.healthcare.clinic.entity.TriageAssessment;
import com.group6.healthcare.clinic.entity.Urgency;
import com.group6.healthcare.clinic.repository.TriageAssessmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Advisory pre-visit triage.
 *
 * <p>Primary path: call the ai-service /triage-assess endpoint which routes to
 * Claude via OpenRouter and returns an advisory urgency, specialty, rationale,
 * red flags and recommended actions.</p>
 *
 * <p>Fallback path: a deterministic rule-based classifier (same rules the
 * original hand-written triage used). Runs whenever the AI call fails for any
 * reason — ai-service unreachable, no API key, model errored, timeout.</p>
 *
 * <p><strong>Safety floor</strong>: regardless of which path produced the
 * assessment, a deterministic red-flag check runs over the raw intake. It can
 * only UPGRADE urgency, never downgrade. So if the LLM ever misclassifies a
 * chest-pain presentation as ROUTINE, the patient will still be flagged as
 * EMERGENCY. This is DR-15 in practice: AI is advisory, never load-bearing for
 * patient safety.</p>
 */
@Service
public class TriageService {

    private static final Logger log = LoggerFactory.getLogger(TriageService.class);

    private final TriageAssessmentRepository repository;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    @Value("${app.ai.service-url:http://localhost:8001}")
    private String aiServiceUrl;

    public TriageService(TriageAssessmentRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder().build();
    }

    @Transactional
    public TriageResponse assess(UUID patientId, TriageRequest req) {
        List<String> symptoms = req.symptoms() == null ? List.of() : req.symptoms();

        // 1. Ask the AI service for the full advisory assessment.
        AiTriageResult ai = tryAiAssessment(req, symptoms);

        // 2. If the AI service was unreachable, fall back to the rule engine.
        //    (The rule engine ALSO runs as a safety floor in step 3 even when AI succeeded.)
        if (ai == null) {
            Classification rule = classifyWithRules(req, symptoms);
            ai = new AiTriageResult(
                    rule.urgency,
                    rule.rationale,
                    suggestSpecialty(symptoms, rule.urgency),
                    rule.redFlags,
                    rule.recommendedActions,
                    BigDecimal.valueOf(0.70),
                    false
            );
        }

        // 3. Deterministic safety floor. Compute the minimum acceptable urgency
        //    from the raw intake; if AI's answer is below that, upgrade. Never
        //    downgrade. This is the non-negotiable patient-safety rail.
        Urgency safetyFloor = computeSafetyFloor(req, symptoms);
        Urgency finalUrgency = max(ai.urgency(), safetyFloor);
        String rationale = ai.rationale();
        if (finalUrgency != ai.urgency()) {
            rationale = "[Safety upgrade from " + ai.urgency() + " to " + finalUrgency
                    + " — red flag detected in intake]. " + rationale;
            log.info("Triage safety floor upgraded urgency from {} to {} for patient {}",
                    ai.urgency(), finalUrgency, patientId);
        }

        TriageAssessment entity = TriageAssessment.builder()
                .patientId(patientId)
                .chiefComplaint(req.chiefComplaint())
                .symptomsJson(writeJson(symptoms))
                .durationDays(req.durationDays())
                .painLevel(req.painLevel())
                .fever(req.fever())
                .chestPain(req.chestPain())
                .shortnessOfBreath(req.shortnessOfBreath())
                .urgency(finalUrgency)
                .rationale(rationale)
                .suggestedSpecialty(ai.suggestedSpecialty())
                .aiPowered(ai.aiPowered())
                .confidence(ai.confidence())
                .redFlagsJson(writeJson(ai.redFlags()))
                .recommendedActionsJson(writeJson(ai.recommendedActions()))
                .build();

        entity = repository.save(entity);
        return toResponse(entity, symptoms);
    }

    public TriageResponse toResponse(TriageAssessment e) {
        return toResponse(e, readStringList(e.getSymptomsJson()));
    }

    private TriageResponse toResponse(TriageAssessment e, List<String> symptoms) {
        return new TriageResponse(
                e.getId(),
                e.getPatientId(),
                e.getChiefComplaint(),
                symptoms,
                e.getDurationDays(),
                e.getPainLevel(),
                e.isFever(),
                e.isChestPain(),
                e.isShortnessOfBreath(),
                e.getUrgency(),
                e.getRationale(),
                e.getSuggestedSpecialty(),
                e.isAiPowered(),
                e.getConfidence(),
                readStringList(e.getRedFlagsJson()),
                readStringList(e.getRecommendedActionsJson()),
                e.getCreatedAt()
        );
    }

    // -------------------------------------------------------------------------
    // AI client
    // -------------------------------------------------------------------------

    private record AiTriageResult(
            Urgency urgency,
            String rationale,
            String suggestedSpecialty,
            List<String> redFlags,
            List<String> recommendedActions,
            BigDecimal confidence,
            boolean aiPowered
    ) {}

    /** Payload the ai-service /triage-assess endpoint expects (snake_case). */
    private record AiTriagePayload(
            String chief_complaint,
            List<String> symptoms,
            int duration_days,
            int pain_level,
            boolean fever,
            boolean chest_pain,
            boolean shortness_of_breath
    ) {}

    /** Response from ai-service (snake_case). */
    private record AiTriageResponsePayload(
            String urgency,
            String rationale,
            String suggested_specialty,
            List<String> red_flags,
            List<String> recommended_actions,
            Double confidence,
            Boolean ai_powered
    ) {}

    private AiTriageResult tryAiAssessment(TriageRequest req, List<String> symptoms) {
        if (aiServiceUrl == null || aiServiceUrl.isBlank()) {
            return null;
        }
        String target = aiServiceUrl.replaceAll("/$", "") + "/triage-assess";
        try {
            AiTriageResponsePayload resp = restClient.post()
                    .uri(target)
                    .body(new AiTriagePayload(
                            req.chiefComplaint(),
                            symptoms,
                            req.durationDays(),
                            req.painLevel(),
                            req.fever(),
                            req.chestPain(),
                            req.shortnessOfBreath()
                    ))
                    .retrieve()
                    .body(AiTriageResponsePayload.class);
            if (resp == null) {
                return null;
            }
            Urgency urgency;
            try {
                urgency = Urgency.valueOf(String.valueOf(resp.urgency()).toUpperCase());
            } catch (IllegalArgumentException e) {
                urgency = Urgency.ROUTINE;
            }
            return new AiTriageResult(
                    urgency,
                    resp.rationale() == null ? "" : resp.rationale(),
                    resp.suggested_specialty() == null ? "General Medicine" : resp.suggested_specialty(),
                    resp.red_flags() == null ? List.of() : resp.red_flags(),
                    resp.recommended_actions() == null ? List.of() : resp.recommended_actions(),
                    resp.confidence() == null ? null : BigDecimal.valueOf(resp.confidence()).setScale(2, java.math.RoundingMode.HALF_UP),
                    resp.ai_powered() != null && resp.ai_powered()
            );
        } catch (Exception ex) {
            log.warn("AI triage fallback invoked ({}: {})", ex.getClass().getSimpleName(), ex.getMessage());
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Deterministic rule engine (fallback + safety floor)
    // -------------------------------------------------------------------------

    private record Classification(
            Urgency urgency,
            String rationale,
            List<String> redFlags,
            List<String> recommendedActions
    ) {}

    /**
     * The minimum urgency this intake can be classified as, based on hard rules.
     * Used only to raise the AI's output — never to lower it.
     */
    private Urgency computeSafetyFloor(TriageRequest req, List<String> symptoms) {
        if (req.chestPain()
                || req.shortnessOfBreath()
                || req.painLevel() >= 8
                || containsAny(symptoms, "chest pain", "chest tightness",
                        "shortness of breath", "severe bleeding", "unconscious")) {
            return Urgency.EMERGENCY;
        }
        if (req.fever() || req.painLevel() >= 5 || req.durationDays() >= 3) {
            return Urgency.URGENT;
        }
        return Urgency.ROUTINE;
    }

    private Classification classifyWithRules(TriageRequest req, List<String> symptoms) {
        Urgency urgency = computeSafetyFloor(req, symptoms);
        List<String> redFlags = new java.util.ArrayList<>();
        if (req.chestPain()) redFlags.add("Chest pain reported");
        if (req.shortnessOfBreath()) redFlags.add("Shortness of breath reported");
        if (req.painLevel() >= 8) redFlags.add("Severe pain (" + req.painLevel() + "/10)");

        String rationale;
        List<String> actions;
        switch (urgency) {
            case EMERGENCY -> {
                rationale = "Critical red-flag indicators detected. Emergency department care "
                        + "strongly advised; do not wait for a scheduled appointment.";
                actions = List.of(
                        "Go to the nearest emergency department or call an ambulance now.",
                        "Do not drive yourself if symptoms are severe."
                );
            }
            case URGENT -> {
                rationale = "Elevated symptom burden with ongoing systemic indicators. "
                        + "A same-day clinical assessment is recommended.";
                actions = List.of(
                        "Book a same-day appointment with a doctor.",
                        "Monitor for new red-flag symptoms (chest pain, breathing difficulty)."
                );
            }
            default -> {
                rationale = "Stable clinical parameters. Standard scheduled clinic or video "
                        + "telehealth consultation is appropriate.";
                actions = List.of(
                        "Book a routine appointment at your convenience within the next few days.",
                        "Rest, hydrate, and monitor symptoms."
                );
            }
        }
        return new Classification(urgency, rationale, redFlags, actions);
    }

    private String suggestSpecialty(List<String> symptoms, Urgency urgency) {
        if (containsAny(symptoms, "chest", "heart", "cardiac", "palpitation")) return "Cardiology";
        if (containsAny(symptoms, "rash", "skin", "allergic")) return "Dermatology";
        if (containsAny(symptoms, "headache", "migraine", "numbness", "seizure")) return "Neurology";
        if (containsAny(symptoms, "pregnancy", "obstetric")) return "Obstetrics & Gynaecology";
        if (containsAny(symptoms, "child", "pediatric")) return "Pediatrics";
        return urgency == Urgency.EMERGENCY ? "Emergency & Internal Medicine" : "General Medicine";
    }

    private boolean containsAny(List<String> symptoms, String... needles) {
        for (String s : symptoms) {
            String lower = s.toLowerCase();
            for (String n : needles) {
                if (lower.contains(n)) return true;
            }
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** EMERGENCY > URGENT > ROUTINE. */
    private Urgency max(Urgency a, Urgency b) {
        return a.ordinal() < b.ordinal() ? a : b;
    }

    private String writeJson(List<String> list) {
        if (list == null) return "[]";
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            return Collections.emptyList();
        }
    }
}
