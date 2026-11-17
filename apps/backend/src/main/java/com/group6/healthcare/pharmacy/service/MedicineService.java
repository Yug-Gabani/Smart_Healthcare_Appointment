package com.group6.healthcare.pharmacy.service;

import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.pharmacy.dto.MedicineCategoryResponse;
import com.group6.healthcare.pharmacy.dto.MedicineResponse;
import com.group6.healthcare.pharmacy.entity.Medicine;
import com.group6.healthcare.pharmacy.repository.MedicineCategoryRepository;
import com.group6.healthcare.pharmacy.repository.MedicineRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class MedicineService {

    private final MedicineRepository medicineRepository;
    private final MedicineCategoryRepository categoryRepository;

    public MedicineService(MedicineRepository medicineRepository, MedicineCategoryRepository categoryRepository) {
        this.medicineRepository = medicineRepository;
        this.categoryRepository = categoryRepository;
    }

    public List<MedicineCategoryResponse> listCategories() {
        return categoryRepository.findAllByActiveTrueOrderByNameAsc()
                .stream()
                .map(MedicineCategoryResponse::from)
                .toList();
    }

    public Page<MedicineResponse> searchMedicines(
            UUID categoryId,
            String search,
            Boolean requiresPrescription,
            Pageable pageable
    ) {
        String query = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        return medicineRepository.searchMedicines(categoryId, query, requiresPrescription, pageable)
                .map(MedicineResponse::from);
    }

    public MedicineResponse getMedicineById(UUID id) {
        Medicine m = medicineRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medicine", id));
        return MedicineResponse.from(m);
    }

    public List<MedicineResponse> getFeaturedMedicines() {
        return medicineRepository.findTop8ByActiveTrueOrderByCreatedAtDesc()
                .stream()
                .map(MedicineResponse::from)
                .toList();
    }
}

