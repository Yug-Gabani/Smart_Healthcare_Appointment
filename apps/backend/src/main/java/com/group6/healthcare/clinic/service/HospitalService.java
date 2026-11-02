package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.HospitalResponse;
import com.group6.healthcare.clinic.entity.Hospital;
import com.group6.healthcare.clinic.repository.HospitalRepository;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
public class HospitalService {

    private final HospitalRepository hospitalRepository;

    public HospitalService(HospitalRepository hospitalRepository) {
        this.hospitalRepository = hospitalRepository;
    }

    @Transactional(readOnly = true)
    public List<HospitalResponse> search(String q, String state, String city, String specialty, int limit) {
        // Empty strings instead of null so Postgres can bind VARCHAR parameters.
        String qN = (q == null) ? "" : q.trim();
        String stateN = (state == null) ? "" : state.trim();
        String cityN = (city == null) ? "" : city.trim();
        String specN = (specialty == null) ? "" : specialty.trim();
        int bounded = Math.max(1, Math.min(limit, 100));
        return hospitalRepository.search(qN, stateN, cityN, specN, PageRequest.of(0, bounded))
                .getContent().stream()
                .map(HospitalService::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public HospitalResponse get(UUID id) {
        Hospital h = hospitalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hospital", id));
        return toResponse(h);
    }

    @Transactional(readOnly = true)
    public List<String> distinctStates() {
        return hospitalRepository.distinctStates();
    }

    @Transactional(readOnly = true)
    public List<String> distinctCities(String state) {
        return hospitalRepository.distinctCities(state == null ? "" : state.trim());
    }

    private static HospitalResponse toResponse(Hospital h) {
        List<String> specs = h.getSpecialties() == null
                ? List.of()
                : Arrays.stream(h.getSpecialties().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty() && !"0".equals(s))
                        .distinct()
                        .limit(20)
                        .toList();
        return new HospitalResponse(
                h.getId(), h.getName(), h.getAddress(), h.getCity(), h.getState(),
                h.getPincode(), h.getPhone(), specs, h.getLogoUrl()
        );
    }
}
