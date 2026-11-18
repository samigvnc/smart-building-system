package com.gridguardian.simulation;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public class BuildingEnergyAllocator {

    public List<BuildingEnergyResult> allocateProportionally(
            List<BuildingLoad> loads,
            double availableEnergyKwh
    ) {

        if (loads == null || loads.isEmpty()) {
            return List.of();
        }

        double totalDemand = loads
                .stream()
                .mapToDouble(BuildingLoad::demandKwh)
                .sum();

        double energyToDistribute =
                Math.min(Math.max(availableEnergyKwh, 0.0), totalDemand);

        List<BuildingEnergyResult> results = new ArrayList<>();

        for (BuildingLoad load : loads) {

            double served = totalDemand == 0.0
                    ? 0.0
                    : energyToDistribute * load.demandKwh() / totalDemand;

            results.add(
                    new BuildingEnergyResult(
                            load.buildingType(),
                            load.critical(),
                            load.demandKwh(),
                            served,
                            load.demandKwh() - served
                    )
            );
        }

        return results;
    }

    public List<BuildingEnergyResult> allocateCriticalFirst(
            List<BuildingLoad> loads,
            double availableEnergyKwh
    ) {

        if (loads == null || loads.isEmpty()) {
            return List.of();
        }

        Map<BuildingType, Double> servedAmounts =
                new EnumMap<>(BuildingType.class);

        double remainingEnergy = Math.max(availableEnergyKwh, 0.0);

        List<BuildingLoad> criticalLoads = loads
                .stream()
                .filter(BuildingLoad::critical)
                .toList();

        List<BuildingLoad> normalLoads = loads
                .stream()
                .filter(load -> !load.critical())
                .toList();

        remainingEnergy =
                distributeGroup(
                        criticalLoads,
                        remainingEnergy,
                        servedAmounts
                );

        distributeGroup(
                normalLoads,
                remainingEnergy,
                servedAmounts
        );

        List<BuildingEnergyResult> results =
                new ArrayList<>();

        for (BuildingLoad load : loads) {

            double served =
                    servedAmounts.getOrDefault(
                            load.buildingType(),
                            0.0
                    );

            results.add(
                    new BuildingEnergyResult(
                            load.buildingType(),
                            load.critical(),
                            load.demandKwh(),
                            served,
                            load.demandKwh() - served
                    )
            );
        }

        return results;
    }

    private double distributeGroup(
            List<BuildingLoad> loads,
            double availableEnergyKwh,
            Map<BuildingType, Double> servedAmounts
    ) {

        if (loads.isEmpty()) {
            return availableEnergyKwh;
        }

        double groupDemand = loads
                .stream()
                .mapToDouble(BuildingLoad::demandKwh)
                .sum();

        double suppliedEnergy =
                Math.min(availableEnergyKwh, groupDemand);

        for (BuildingLoad load : loads) {

            double served = groupDemand == 0.0
                    ? 0.0
                    : suppliedEnergy
                    * load.demandKwh()
                    / groupDemand;

            servedAmounts.put(
                    load.buildingType(),
                    served
            );
        }

        return availableEnergyKwh - suppliedEnergy;
    }
}