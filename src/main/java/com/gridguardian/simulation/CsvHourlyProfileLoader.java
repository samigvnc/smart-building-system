package com.gridguardian.simulation;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class CsvHourlyProfileLoader {

    public HourlyProfile loadFromResource(String resourcePath)
            throws IOException {

        InputStream inputStream =
                getClass()
                        .getClassLoader()
                        .getResourceAsStream(resourcePath);

        if (inputStream == null) {
            throw new IOException(
                    "Resource not found: " + resourcePath
            );
        }

        try (BufferedReader reader =
                     new BufferedReader(
                             new InputStreamReader(inputStream)
                     )) {

            return readProfile(reader);
        }
    }

    public HourlyProfile load(Path path)
            throws IOException {

        if (path == null) {
            throw new IllegalArgumentException(
                    "Path cannot be null."
            );
        }

        try (BufferedReader reader =
                     Files.newBufferedReader(path)) {

            return readProfile(reader);
        }
    }

    private HourlyProfile readProfile(
            BufferedReader reader
    ) throws IOException {

        List<Double> values = new ArrayList<>();

        String header = reader.readLine();

        if (header == null ||
                !header.trim().equalsIgnoreCase("hour,value")) {

            throw new IOException(
                    "CSV header must be: hour,value"
            );
        }

        String line;
        int expectedHour = 0;

        while ((line = reader.readLine()) != null) {

            if (line.isBlank()) {
                continue;
            }

            String[] parts = line.split(",");

            if (parts.length != 2) {
                throw new IOException(
                        "Invalid CSV row: " + line
                );
            }

            int hour;
            double value;

            try {
                hour = Integer.parseInt(parts[0].trim());
                value = Double.parseDouble(parts[1].trim());
            } catch (NumberFormatException exception) {
                throw new IOException(
                        "Invalid numeric value in row: " + line,
                        exception
                );
            }

            if (hour != expectedHour) {
                throw new IOException(
                        "Expected hour "
                                + expectedHour
                                + " but found "
                                + hour
                );
            }

            if (value < 0) {
                throw new IOException(
                        "Profile value cannot be negative."
                );
            }

            values.add(value);
            expectedHour++;
        }

        if (values.size() != 24) {
            throw new IOException(
                    "CSV profile must contain exactly 24 hourly rows."
            );
        }

        return new HourlyProfile(values);
    }
}