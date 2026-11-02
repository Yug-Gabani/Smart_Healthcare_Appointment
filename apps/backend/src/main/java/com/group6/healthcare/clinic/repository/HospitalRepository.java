package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.Hospital;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HospitalRepository extends JpaRepository<Hospital, UUID> {

    /**
     * All params are empty-string sentinels (never null) so Postgres can infer VARCHAR types.
     * The service layer coerces nulls to "" before calling this.
     */
    @Query("""
        SELECT h FROM Hospital h
         WHERE (:q = '' OR LOWER(h.name) LIKE LOWER(CONCAT('%', :q, '%')))
           AND (:state = '' OR LOWER(h.state) = LOWER(:state))
           AND (:city = '' OR LOWER(h.city) = LOWER(:city))
           AND (:specialty = '' OR LOWER(h.specialties) LIKE LOWER(CONCAT('%', :specialty, '%')))
         ORDER BY h.name ASC
        """)
    Page<Hospital> search(@Param("q") String q,
                          @Param("state") String state,
                          @Param("city") String city,
                          @Param("specialty") String specialty,
                          Pageable pageable);

    @Query("SELECT DISTINCT h.state FROM Hospital h WHERE h.state IS NOT NULL ORDER BY h.state ASC")
    List<String> distinctStates();

    @Query("SELECT DISTINCT h.city FROM Hospital h WHERE h.city IS NOT NULL " +
           "AND (:state = '' OR LOWER(h.state) = LOWER(:state)) ORDER BY h.city ASC")
    List<String> distinctCities(@Param("state") String state);

    Optional<Hospital> findFirstByNameIgnoreCase(String name);

    long count();
}
