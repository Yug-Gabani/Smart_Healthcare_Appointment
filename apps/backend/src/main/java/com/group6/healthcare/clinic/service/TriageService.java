package com.group6.healthcare.clinic.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.healthcare.clinic.dto.TriageRequest;
import com.group6.healthcare.clinic.dto.TriageResponse;
import com.group6.healthcare.clinic.entity.TriageAssessment;
import com.group6.healthcare.clinic.entity.Urgency;
import com.group6.healthcare.clinic.repository.TriageAssessmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Rule-based advisory triage. Mirrors the frontend rules in triageMock.ts so the server
 * is the single source of truth. The emergency pre-check runs before anything else to
 * guarantee red-flag cases are never classified as routine.
 */
@Service
public class TriageService {

    private final TriageAssessmentRepository repository;
    private final ObjectMapper objectMapper;

    public TriageService(TriageAssessmentRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public TriageResponse assess(UUID patientId, TriageRequest req) {
        List<String> symptoms = req.symptoms() == null ? List.of() : req.symptoms();
        Classification result = classify(req, symptoms);
        String specialty = suggestSpecialty(symptoms, result.urgency);

        TriageAssessment entity = TriageAssessment.builder()
                .patientId(patientId)
                .chiefComplaint(req.chiefComplaint())
                .symptomsJson(writeSymptoms(symptoms))
                .durationDays(req.durationDays())
                .painLevel(req.painLevel())
                .fever(req.fever())
                .chestPain(req.chestPain())
                .shortnessOfBreath(req.shortnessOfBreath())
                .urgency(result.urgency)
                .rationale(result.rationale)
                .suggestedSpecialty(specialty)
                .build();

        entity = repository.save(entity);
        return toResponse(entity, symptoms);
    }

    public TriageResponse toResponse(TriageAssessment e) {
        return toResponse(e, readSymptoms(e.getSymptomsJson()));
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
                e.getCreatedAt()
        );
    }

    private record Classification(Urgency urgency, String rationale) {}

    private Classification classify(TriageRequest req, List<String> symptoms) {
        boolean emergency =
                req.chestPain()
                        || req.shortnessOfBreath()
                        || req.painLevel() >= 8
                        || containsAny(symptoms, "chest pain", "chest tightness",
                                       "shortness of breath", "severe bleeding", "unconscious");
        if (emergency) {
            return new Classification(Urgency.EMERGENCY,
                    "Critical red-flag indicators detected (severe pain >= 8/10, respiratory distress, "
                            + "or cardiopulmonary warning signs). Emergency department care strongly advised.");
        }

        boolean urgent = req.fever() || req.painLevel() >= 5 || req.durationDays() >= 3;
        if (urgent) {
            return new Classification(Urgency.URGENT,
                    "Elevated symptom burden with ongoing systemic indicators. "
                            + "Same-day clinical assessment recommended.");
        }

        return new Classification(Urgency.ROUTINE,
                "Stable clinical parameters. Standard scheduled clinic or video telehealth "
                        + "consultation is appropriate.");
    }

    private String suggestSpecialty(List<String> symptoms, Urgency urgency) {
        if (containsAny(symptoms, "chest", "heart", "cardiac", "palpitation")) {
            return "Cardiology";
        }
        if (containsAny(symptoms, "rash", "skin", "allergic")) {
            return "Dermatology";
        }
        if (containsAny(symptoms, "headache", "migraine", "numbness", "seizure")) {
            return "Neurology";
        }
        if (containsAny(symptoms, "pregnancy", "obstetric")) {
            return "Obstetrics & Gynaecology";
        }
        if (containsAny(symptoms, "child", "pediatric")) {
            return "Pediatrics";
        }
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

    private String writeSymptoms(List<String> symptoms) {
        try {
            return objectMapper.writeValueAsString(symptoms);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private List<String> readSymptoms(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            return Collections.emptyList();
        }
    }
}
