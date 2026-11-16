package com.gridguardian.simulation;

import java.io.IOException;
import java.util.List;

public class CsvSimulationInputProvider implements SimulationInputProvider {

    private final List<Building> buildings;
    private final CsvHourlyProfileLoader profileLoader;
    private final HourlyInputFactory inputFactory;

    public CsvSimulationInputProvider(List<Building> buildings) {
        if (buildings == null || buildings.isEmpty()) {
            throw new IllegalArgumentException("Buildings cannot be empty.");
        }

        this.buildings = List.copyOf(buildings);
        this.profileLoader = new CsvHourlyProfileLoader();
        this.inputFactory = new HourlyInputFactory();
    }

    @Override
    public List<HourlyInput> loadInputs() {
        try {
            HourlyProfile solarProfile =
                    profileLoader.loadFromResource("data/solar.csv");

            HourlyProfile priceProfile =
                    profileLoader.loadFromResource("data/price.csv");

            return inputFactory.create(
                    buildings,
                    solarProfile,
                    priceProfile
            );

        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Failed to load simulation input data.",
                    exception
            );
        }
    }
}