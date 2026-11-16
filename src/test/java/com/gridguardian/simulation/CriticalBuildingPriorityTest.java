package com.gridguardian.simulation;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class CriticalBuildingPriorityTest {

    @Test
    void shouldServeCriticalBuildingBeforeNormalBuildings() {

        BuildingEnergyAllocator allocator =
                new BuildingEnergyAllocator();

        List<BuildingLoad> loads =
                List.of(
                        new BuildingLoad(
                                BuildingType.LABORATORY,
                                true,
                                40.0
                        ),
                        new BuildingLoad(
                                BuildingType.DORMITORY,
                                false,
                                30.0
                        ),
                        new BuildingLoad(
                                BuildingType.LIBRARY,
                                false,
                                20.0
                        )
                );

        List<BuildingEnergyResult> results =
                allocator.allocateCriticalFirst(
                        loads,
                        50.0
                );

        BuildingEnergyResult laboratory =
                findResult(
                        results,
                        BuildingType.LABORATORY
                );

        BuildingEnergyResult dormitory =
                findResult(
                        results,
                        BuildingType.DORMITORY
                );

        BuildingEnergyResult library =
                findResult(
                        results,
                        BuildingType.LIBRARY
                );

        assertEquals(
                40.0,
                laboratory.servedEnergyKwh(),
                0.001
        );

        assertEquals(
                0.0,
                laboratory.unservedEnergyKwh(),
                0.001
        );

        assertEquals(
                6.0,
                dormitory.servedEnergyKwh(),
                0.001
        );

        assertEquals(
                4.0,
                library.servedEnergyKwh(),
                0.001
        );
    }

    private BuildingEnergyResult findResult(
            List<BuildingEnergyResult> results,
            BuildingType buildingType
    ) {

        return results
                .stream()
                .filter(
                        result ->
                                result.buildingType()
                                        == buildingType
                )
                .findFirst()
                .orElseThrow();
    }
}