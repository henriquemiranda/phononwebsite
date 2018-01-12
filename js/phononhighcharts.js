define(['highcharts'], function() {

    return class PhononHighcharts {

        constructor(container) {
       
            this.container = container;

            this.phonon = { highsym_qpts: [] }
            let phonon = this.phonon;

            this.labels_formatter = function(phonon) {
                return function() {
                    if ( phonon.highsym_qpts[this.value] ) {
                        let label = phonon.highsym_qpts[this.value];
                        label = label.replace("$","").replace("$","");
                        label = label.replace("\\Gamma","Γ");
                        label = label.replace("GAMMA","Γ");
                        label = label.replace("DELTA","Δ");
                        label = label.replace("\\Sigma","Σ");
                        label = label.replace("_","");
                        return label;
                    }
                    return ''
                }
            }

            this.HighchartsOptions = {
                chart: { type: 'line',
                         zoomType: 'xy' },
                title: { text: 'Phonon dispersion' },
                xAxis: { plotLines: [],
                         lineWidth: 0,
                         minorGridLineWidth: 0,
                         lineColor: 'transparent',
                         minorTickLength: 0,
                         tickLength: 0,
                         labels: {
                            style: { fontSize:'20px' }
                         }
                       },
                yAxis: { plotLines: [],
                         title: { text: 'Frequency (cm<sup>-1</sup>)' },
                         plotLines: [ {value: 0, color: '#000000', width: 2} ]
                       },
                tooltip: { formatter: function(x) { return Math.round(this.y*100)/100+' cm<sup>-1</sup>' } },
                legend: { enabled: false },
                series: [],
                plotOptions: { line:   { animation: false },
                               series: { allowPointSelect: true,
                                         marker: { states: { select: { fillColor: 'red',
                                                                       radius: 5,
                                                                       lineWidth: 0 }
                                                           }
                                                 },
                                         cursor: 'pointer',
                                         point: { events: { } }
                                       }
                             }
            };
        }
        
        setClickEvent( phononweb ) {
            let click_event = function () {
                phononweb.k = phononweb.phonon.qindex[this.x];
                phononweb.n = this.series.name;
                phononweb.setVibrations();
                phononweb.visualizer.update(phononweb);
            }
            this.HighchartsOptions.plotOptions.series.point.events.click = click_event 
        }

        update(phonon) {
            /*
            update phonon dispersion plot
            */
            
            this.phonon = phonon;

            //set the minimum of the plot with the smallest phonon frequency
            let minVal = 0;
            for (let i=0; i<phonon.eigenvalues.length; i++) {
                let min = Math.min.apply(null, phonon.eigenvalues[i])
                if ( minVal > min ) {
                    minVal = min;
                }
            }
            if (minVal > -1) minVal = 0;


            //get positions of high symmetry qpoints
            let ticks = [];
            for (let k in phonon.highsym_qpts) {
                ticks.push(k);
            }

            //get the high symmetry qpoints for highcharts
            let plotLines = []
            for (let i=0; i<ticks.length ; i++ ) {
                plotLines.push({ value: ticks[i],
                                 color: '#000000',
                                 width: 2 })
            }

            //actually set the eigenvalues
            this.getGraph(phonon);

            this.HighchartsOptions.series = this.highcharts;
            this.HighchartsOptions.xAxis.tickPositions = ticks;
            this.HighchartsOptions.xAxis.plotLines = plotLines;
            this.HighchartsOptions.xAxis.labels.formatter = this.labels_formatter(phonon)
            this.HighchartsOptions.yAxis.min = minVal;
            this.container.highcharts(this.HighchartsOptions);
        }

        getGraph(phonon) {
            /* 
            From a phonon object containing:
                distances : distance between the k-points 
                eigenvalues : eigenvalues
            put the data in the highcharts format 
            */

            let eival = phonon.eigenvalues;
            let dists = phonon.distances; 
            let line_breaks = phonon.line_breaks;

            let nbands = eival[0].length;
            this.highcharts = [];

            //go through the eigenvalues and create eival list
            for (let n=0; n<nbands; n++) {
                //iterate over the line breaks
                for (let i=0; i<line_breaks.length; i++) {
                    let startk = line_breaks[i][0];
                    let endk = line_breaks[i][1];

                    let eig = [];

                    //iterate over the q-points
                    for (let k=startk; k<endk; k++) {
                        eig.push([dists[k],eival[k][n]]);
                    }

                    //add data
                    this.highcharts.push({
                        name:  n.toString(),
                        color: "#0066FF",
                        marker: { radius: 2, symbol: "circle"},
                        data: eig
                       });
                }
            }
        }
    }

});
