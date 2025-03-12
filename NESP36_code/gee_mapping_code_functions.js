/*
###############################################################

Global intertidal and sub-tidal mapping (seagrass focus)

IP and copyright owners:
- Univeristy of New South Wales

Contact:
- Mitchell Lyons
- mitchell.lyons@unsw.edu.au; mitchell.lyons@gmail.com

###############################################################
*/

var tayaritja_BOSSprob_24 = {
  //study site variables
  // note you may need to (you should anyway) update to your own assets
  training_data_set: "projects/ee-srdh/assets/training/tayaritja_BOSS_buffer_pts",
  class_field: "Sg_pct", // field with the training data
  study_site_name: "tayaritja_sgprob",
  depth: "projects/ee-srdh/assets/imagery/tayaritja/lidar3m",
  waves: "projects/ee-srdh/assets/imagery/tayaritja/waves",
  manual_mask: "projects/ee-srdh/assets/imagery/tayaritja/extent_clip",
  // Sentinel-2 / Landsat8 iamge stack varaibles
  start_date: '2023-01-01',
  end_date: '2024-12-31',
  cloudy_threshold: 5, // lte cloudy scene percentage threshold (to reduce stack length)
  gcsp_thresh: 0.85, // S2 Google Cloud score + threshold
  //s2_keep_bands: ['B1','B2','B3','B4','B5','B6','B7','B8'],
  s2_keep_bands: ['B2','B3','B4','B8'],
  ls8_keep_bands: ['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5'],
  // other imagery == Planet scene details
  doveR: "", // Dove-S/R image if existing
  superdove: "projects/ee-srdh/assets/imagery/tayaritja/sd_feb24", // SuperDove image if existing
  // classification + model variables
  segment_image: false, // apply segmentation to the stack ebfore classification?
  model_arch: 'brt',
  output_mode: 'REGRESSION',
  print_model: true, // print out model diagnostics to console?
  ls8_model_bands: ["all_bands"],
  s2_model_bands:['B2_p20','B2_p40','B2_p60',//'B2_p80',
                  'B3_p20','B3_p40','B3_p60',//'B3_p80',
                  'B4_p20','B4_p40','B4_p60',//'B4_p80',
                  //'B8_p20','B8_p40','B8_p60','B8_p80','B8_p100',
                  //'rg_median','rb_median',
                  //'ndvi','ndwi1'],
                  'depth','depth_std','slope','slope_avg','rugosity',
                  'wf_max','wf_avg','wf_std'],
  sd_model_bands: ['b1','b2','b3','b4','b5','b6','b7',
                   'depth','depth_std','slope','slope_avg','rugosity',
                   'wf_max','wf_avg','wf_std'],
  // post processing varaibles
  land_mask: true, // For large areas land masking via OSM can be expensive
  depth_mask: true, // apply depth masking (make sure bathymetry layer is defined)
  depth_positive: false, // is underwater denoted by positive values? (if true layer will my multiplied by -1)
  depth_thresh: -30, // depth below which masking is applied
  depth_only_map: true, // constrain the mapping to the extent of the depth layer?
  apply_manual_mask: false, // apply a manual mask (make sure the layer is defined)
  prob_thresh: 0.75 // threshold for making extent map (e.g. seagrass, coral etc.) from model probablity
};

// S2 level 2A - function to mask cloud in each image within image collection
function maskS2clouds_2A(keep_bands, output_mask) {
    var wrap = function(image) {
      var scl = image.select('SCL');
      var cloud_mask = scl.lt(7).and(scl.gt(3));
      return image.select(keep_bands).updateMask(cloud_mask)
                  .updateMask(output_mask);
    };
    return wrap;
  }
  
  // S2 level 2A - function to mask cloud in each image within image collection
  function maskS2clouds_2A_gcsp(keep_bands, output_mask, gcsp_thresh) {
    var wrap = function(image) {
      var cloud_mask = image.select('cs_cdf').gte(gcsp_thresh);
      return image.select(keep_bands).updateMask(cloud_mask)
                  .updateMask(output_mask);
    };
    return wrap;
  }
  
  // S2 level 2A - function to mask cloud in each image within image collection (no extent, e.g. point only extraction)
  function maskS2clouds_2A_noextent(keep_bands) {
    var wrap = function(image) {
      var scl = image.select('SCL');
      var cloud_mask = scl.lt(7).and(scl.gt(3));
      return image.select(keep_bands).updateMask(cloud_mask);
    };
    return wrap;
  }
  
  // S2 level 2A - add very shallow/exposed acqisition fitlering
  function maskS2cloudsShallow_2A(keep_bands, output_mask, ndwi_threshold) {
    var wrap = function(image) {
      var scl = image.select('SCL');
      var cloud_mask = scl.lt(7).and(scl.gt(3));
      var cloud_masked_image = image.updateMask(cloud_mask);
      var ndwi = cloud_masked_image.normalizedDifference(['B3','B8']);
      var shallow_mask = ndwi.lt(ee.Image(ndwi_threshold));
      return cloud_masked_image.select(keep_bands).updateMask(shallow_mask)
                               .updateMask(output_mask);  
    };
    return wrap;
  }
  
  // LS8, L2, T2 - cloud and saturation mask
  function maskLS8clouds_L2(keep_bands, output_mask) {
    var wrap = function(image) {
      // Develop masks for unwanted pixels (fill, cloud, cloud shadow).
      var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
      var saturationMask = image.select('QA_RADSAT').eq(0);
      return image.select(keep_bands).updateMask(qaMask).updateMask(saturationMask)
                  .updateMask(output_mask);
    };
    return wrap;
  }
  
  // LS8, L2, T2 - cloud and saturation mask (no extent, e.g. point only extraction)
  function maskLS8clouds_L2_noextent(keep_bands, output_mask) {
    var wrap = function(image) {
      // Develop masks for unwanted pixels (fill, cloud, cloud shadow).
      var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
      var saturationMask = image.select('QA_RADSAT').eq(0);
      return image.select(keep_bands).updateMask(qaMask).updateMask(saturationMask);
    };
    return wrap;
  }
  
  // helper function for diags
  var print_var_imp = function(classifier) {
    var dic = classifier.explain();
    print(dic);
    
    var chart =
      ui.Chart.feature.byProperty(ee.Feature(null, ee.Dictionary(dic).get('importance')))
      .setChartType('ColumnChart')
      .setOptions({
      title: 'Variable Importance',
      legend: {position: 'none'},
      hAxis: {title: 'Bands'},
      vAxis: {title: 'Importance'}
      });
    print(chart);
  };
  
  // Build a function that samples, fits and classifies
  var sample_classify = function(image_stack, output_mask, training, class_field, pixel_size, input_bands, print_stats, output_mode, model_arch, min_trees, num_leaf) {
    // default values
    if (num_trees === undefined || num_trees === null){var num_trees = 500}
    if (min_leaf === undefined || min_leaf === null){var min_leaf = 3}
    
    // use all bands or the selection specified
    var use_bands = ee.Algorithms.If(ee.List(input_bands).slice(0,1).equals(["all_bands"]), image_stack.bandNames(), input_bands);
    print("Bands used in model:", use_bands);
    // sample the stack
    var training_library = image_stack.sampleRegions({
      collection: training,
      properties: [class_field],
      scale: pixel_size,
      geometries: false,
      tileScale: 4
    });
    // train the model
    if (model_arch == 'brt') {
      var classifier_opts = ee.Classifier.smileGradientTreeBoost({
        numberOfTrees: 1000,
        shrinkage: 0.005,
        samplingRate: 0.6,
        maxNodes: 10,
        loss: "LeastAbsoluteDeviation",
        seed: 42
      });
    } else if (model_arch == 'rf') {
      var classifier_opts = ee.Classifier.smileRandomForest({
        numberOfTrees: num_trees,
        variablesPerSplit: null,
        minLeafPopulation: min_leaf,
        bagFraction: 0.6,
        maxNodes: null,
        seed: 42
      });
    } else {
      print("Please secify a model architecture");
    }
    var fitted_classifier = classifier_opts.train(training_library, class_field, use_bands).setOutputMode(output_mode);
    // print diagnostics
    if (print_stats) print_var_imp(fitted_classifier);
    // fit the model
    var output_classification = image_stack.updateMask(output_mask).classify(fitted_classifier);
    return output_classification;
  };
  
  
  var sample_export = function(image_stack, training, class_field, pixel_size, input_bands) {
    
    // use all bands or the selection specified
    var use_bands = ee.Algorithms.If(ee.List(input_bands).slice(0,1).equals(["all_bands"]), image_stack.bandNames(), input_bands);
    print("Bands used in model:", use_bands);
    // sample the stack
    var training_library = image_stack.sampleRegions({
      collection: training,
      properties: [class_field],
      scale: pixel_size,
      geometries: false,
      tileScale: 2
    });
    return training_library;
  };
  
  // function to calculate pseudo accuracy based on different probability threhsolds
  var calc_threshold_accuracy = function(probs, test, class_field) {
    var wrap = function(f) {
      var binary_img = probs.gte(ee.Number(f)).rename('binary');
      var errormat = binary_img.sampleRegions(test, [class_field]).errorMatrix(class_field, 'binary');
      return ee.Dictionary(["accuracy", errormat.accuracy(), "FB1", errormat.fscore(1)]);
    };
    return wrap;
  };
  
  // function to plot accuracy values against corresponding threhsold list
  var make_accuracy_chart = function(accuracy_list, threshold_list, label) {
    var chart = ui.Chart.array.values({array: accuracy_list, axis: 0, xLabels: threshold_list})
                  .setOptions({
                    title: 'Accuracy at different probability thresholds: ' + label,
                    pointSize: 4,
                    hAxis: {
                      'title': 'Probability threshold choice',
                      titleTextStyle: {italic: false, bold: true}
                    },
                    vAxis: {
                      'title': 'Accuracy',
                      titleTextStyle: {italic: false, bold: true}
                    }
                  });
    print(chart);
  };
  
  // function to plot seagrass cover against probability threshold values
  var make_cover_thresh_chart = function(probs, test, class_field, trim, label) {
    var test_sample = test.randomColumn().filter(ee.Filter.lt('random', trim));
    var probs_cover_col = probs.rename('probability').sampleRegions(test_sample, [class_field]);
    var chart = ui.Chart.feature.byFeature(probs_cover_col, 'probability', class_field)
                  .setChartType('ScatterChart')
                  .setOptions({
                    title: 'Probability values vs. seagrass % cover observations:' + label,
                    pointSize: 4,
                    hAxis: {
                      'title': 'Classification probability value',
                      titleTextStyle: {italic: false, bold: true}
                    },
                    vAxis: {
                      'title': 'Seagrass cover (%)',
                      titleTextStyle: {italic: false, bold: true}
                    }
                  });
    print(chart);
  };
  
  
  var calc_threshold_area = function(probs, aoi, resolution) {
    var wrap = function(f) {
      var binary_img = probs.gte(ee.Number(f)).selfMask().rename('binary');
      var area = binary_img.reduceRegion({
        reducer: ee.Reducer.count(),
        geometry: aoi,
        scale: resolution,
        maxPixels: 1e13
      });
      return area.get('binary');
    };
    return wrap;
  };
  
  var make_area_thresh_chart = function(area_list, threshold_list, label) {
    var chart = ui.Chart.array.values({array: area_list, axis: 0, xLabels: threshold_list})
                  .setOptions({
                    title: 'Area of seagrass at different probability thresholds: ' + label,
                    pointSize: 4,
                    hAxis: {
                      'title': 'Probability threshold choice',
                      titleTextStyle: {italic: false, bold: true}
                    },
                    vAxis: {
                      'title': 'Seagrass area (pixels)',
                      titleTextStyle: {italic: false, bold: true}
                    }
                  });
    print(chart);
  };
  
  
  // exports
  exports = {
    tayaritja_BOSSprob_24: tayaritja_BOSSprob_24,
    maskS2clouds_2A: maskS2clouds_2A,
    maskS2clouds_2A_gcsp: maskS2clouds_2A_gcsp,
    maskS2clouds_2A_noextent: maskS2clouds_2A_noextent,
    maskS2cloudsShallow_2A: maskS2cloudsShallow_2A,
    maskLS8clouds_L2: maskLS8clouds_L2,
    maskLS8clouds_L2_noextent: maskLS8clouds_L2_noextent,
    print_var_imp: print_var_imp,
    sample_classify: sample_classify,
    sample_export: sample_export,
    calc_threshold_accuracy: calc_threshold_accuracy,
    make_accuracy_chart: make_accuracy_chart,
    make_cover_thresh_chart: make_cover_thresh_chart,
    calc_threshold_area: calc_threshold_area,
    make_area_thresh_chart: make_area_thresh_chart
  };
