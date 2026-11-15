package com.group6.healthcare.pharmacy.controller;

import com.group6.healthcare.common.dto.ApiResponse;
import com.group6.healthcare.pharmacy.dto.MedicineCategoryResponse;
import com.group6.healthcare.pharmacy.dto.MedicineResponse;
import com.group6.healthcare.pharmacy.service.MedicineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/pharmacy")
@Tag(name = "Pharmacy Catalog", description = "Browse medicines, search catalog, and view categories")
public class MedicineCatalogController {

    private final MedicineService medicineService;

    public MedicineCatalogController(MedicineService medicineService) {
        this.medicineService = medicineService;
    }

    @GetMapping("/categories")
    @Operation(summary = "List all active medicine categories")
    public ApiResponse<List<MedicineCategoryResponse>> listCategories() {
        return ApiResponse.ok(medicineService.listCategories());
    }

    @GetMapping("/medicines")
    @Operation(summary = "Search and filter medicines by name, category, or prescription requirements")
    public ApiResponse<Page<MedicineResponse>> searchMedicines(
            @RequestParam(name = "categoryId", required = false) UUID categoryId,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "requiresPrescription", required = false) Boolean requiresPrescription,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "sort", defaultValue = "name") String sort,
            @RequestParam(name = "direction", defaultValue = "ASC") String direction
    ) {
        Sort.Direction dir = "DESC".equalsIgnoreCase(direction) ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageRequest = PageRequest.of(Math.max(0, page), Math.min(size, 100), Sort.by(dir, sort));
        Page<MedicineResponse> results = medicineService.searchMedicines(categoryId, search, requiresPrescription, pageRequest);
        return ApiResponse.ok(results);
    }

    @GetMapping("/medicines/featured")
    @Operation(summary = "Get featured medicines for landing and store highlights")
    public ApiResponse<List<MedicineResponse>> getFeaturedMedicines() {
        return ApiResponse.ok(medicineService.getFeaturedMedicines());
    }

    @GetMapping("/medicines/{id}")
    @Operation(summary = "Get comprehensive medicine details, composition, dosage, and stock")
    public ApiResponse<MedicineResponse> getMedicineById(@PathVariable UUID id) {
        return ApiResponse.ok(medicineService.getMedicineById(id));
    }
}

