/*
 * Copyright 2013 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author Andrew Eisenberg
 */

/*
 * view for displaying batch jobs
 */

define(['underscore', 'backbone', 'xd.utils', 'xd.conf', 'xd.model', 'views/batchDetail'],
function(_, Backbone, utils, conf, model, BatchDetail) {

    // maps job names to batchDetails views that are currently expanded
    var expanded = {};

    function extractJob(event) {
        var name = event.currentTarget.getAttribute('job-name');
        return model.batchJobs.get(name);
    }

    function getStatusColor (exitStatus) {
        var alertClass;
        switch(exitStatus) {
            case 'FAILED':
               alertClass = 'alert-error';
               break;
            case 'STARTED':
               alertClass = 'alert-alert';
               break;
            case 'SUCCESS':
            case 'COMPLETED':
               alertClass = 'alert-success';
               break;
            default: 
                alertClass = '';
        }
        return alertClass;
    }

    function transformForRender (jobs) {
        var newJobs = jobs.map(function(job) {
            var hasExecutions = job.attributes.exitStatus ? true : false;
            return {
                name : job.attributes.name,
                details : job.attributes.name + '_details',
                detailsRow : job.attributes.name + '_detailsRow',
                executionCount : (hasExecutions ? job.attributes.executionCount : '<em>no executions<em>'),
                exitStatus : (hasExecutions ? job.attributes.exitStatus.exitCode : '<em>no executions<em>'),
                alertClass : getStatusColor(hasExecutions ? job.attributes.exitStatus.exitCode : ''),
                jobParameters : (hasExecutions ? job.attributes.jobParameters : '<em>no executions<em>'),
                startTime : hasExecutions ? (job.attributes.startDate + ':' + 
                        job.attributes.startTime) : '<em>no executions<em>',
                duration : hasExecutions ? job.attributes.duration : '<em>no executions<em>',
                launchable : job.attributes.launchable ? '' : 'disabled',
                hasExecutions : hasExecutions
            };
        });
        return newJobs;
    }

    /**
     * Check if string 'label' contains all the characters (in the right order
     * but not necessarily adjacent) from charseq.
     *
     * @param {String} label the text to check
     * @param {String} charseq the sequence of chars to check for
     * @type {Boolean} true if matches
     */
    function matches(label, charseq) {
        label = label.toLowerCase();
        var cpos = 0;
        for (var i=0;i<label.length;i++) {
            if (label.charAt(i)===charseq[cpos]) {
                cpos++;
            }
            if (cpos===charseq.length) {
                return true;
            }
        }
        return false;
    }

    var Batch = Backbone.View.extend({
        events: {
            "click button.detailAction": "showDetails",
            "click button.launchAction": "launch",
            "click button.launchWithParametersAction": "launchWithParameters",
            "keyup input#job_filter": "filterJobs"
        },

        initialize: function() {
            this.listenTo(model.batchJobs, 'change', this.render);
            this.listenTo(model.batchJobs, 'reset', this.render);
            model.batchJobs.startFetching();
        },

        render: function() {
            // first remove all old expanded
            Object.keys(expanded).forEach(function(key) {
                expanded[key].remove();
            }, this);
            this.$el.html(_.template(utils.getTemplate(conf.templates.batchList), { 
                jobs: transformForRender(model.batchJobs.models) 
            }));

            // now add the expanded nodes back
            Object.keys(expanded).forEach(function(key) {
                var detailsId = '#' + key + '_details';
                var detailsElt = this.$el.find(detailsId);
                if (detailsElt.length > 0) {
                    var detailsView = expanded[key];
                    detailsElt.replaceWith(detailsView.$el);
                    detailsView.$detailsRow = this.$('#' + key + '_detailsRow');
                    detailsView.$detailsRow.show();
                    detailsView.delegateEvents(detailsView.events);
                } else {
                    // job not here any more
                    delete expanded[key];
                }
            }, this);

            this.filterJobs();

            return this;
        },

        showDetails: function(event) {
            var job = extractJob(event);
            if (job) {
                var detailsView = expanded[job.id];
                if (detailsView) {
                    // remove from view
                    detailsView.destroy();
                    delete expanded[job.id];
                } else {
                    this.stopListening(model.batchJobs, 'change');
                    job.fetch().then(function() {
                        job.get('jobInstances').fetch().then(function() {
                            var detailsView = new BatchDetail({job: job });
                            detailsView.setElement('#' + job.id + '_details');
                            detailsView.$detailsRow = this.$('#' + job.id + '_detailsRow');
                            detailsView.render();
                            // don't use bootstrap collapse.  
                            // See stackoverflow.com/questions/18495653/how-do-i-collapse-a-table-row-in-bootstrap/18496059#18496059
                            detailsView.$detailsRow.show();
                            expanded[job.id] = detailsView;
                            this.listenTo(model.batchJobs, 'change', this.render);
                        }.bind(this));
                    }.bind(this));
                }
            }
        },

        launch: function(event) {
            var job = extractJob(event);
            if (job) {
                job.launch().then(function() {
                    var detailsView = expanded[job.id];
                    if (detailsView) {
                        job.fetch().then(function() {
                            detailsView.options.job = job;
                            detailsView.render();
                        });
                    }
                });
            }
        },

        launchWithParameters: function(event) {
            var job = extractJob(event);
            if (job) {
                job.launch(JSON.stringify({arg1:1, arg2:'bar'})).then(function() {
                    var detailsView = expanded[job.id];
                    if (detailsView) {
                        job.fetch().then(function() {
                            detailsView.options.job = job;
                            detailsView.render();
                        });
                    }
                });
            }
        },

        filterJobs : function(event) {
            if (event) {
                this.filterValue = event.currentTarget.value;
            }
            if (!this.filterValue) {
                return;
            }

            // get all rows
            var rows = this.$('table#batch > tbody > tr');
            rows.each(function (i) {
                var row = $(rows[i]), id = row.attr('id');
                var isDetails;
                if (id) { // avoid the header row
                    if (id.indexOf('_detailsRow') === id.length - '_detailsRow'.length) {
                        id = id.substr(0, id.length - '_detailsRow'.length);
                        isDetails = true;
                    }
                    if (matches(id, this.filterValue)) {
                        if (!isDetails || expanded[id]) {
                            // never show details...this is wrong, but OK for now
                            // we are forgetting where details used to be shown
                            row.show();
                        }
                    } else {
                        row.hide();
                    }
                }
            });
        }
    });
    return Batch;
});