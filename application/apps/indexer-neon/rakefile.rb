# frozen_string_literal: true

require 'rake/clean'
require '../../../rake-extensions'

LOCAL_EXAMPLE_DIR = "#{Dir.home}/tmp/logviewer_usecases"
TEST_DIR = './tests'
OUT_DIR = './out'
TESTS_JS_REQUIRE = 'require("./dist/apps/indexer-neon/src/tests.js")'

directory OUT_DIR
CLEAN.include(["#{OUT_DIR}/*.*",
               "#{LOCAL_EXAMPLE_DIR}/indexing/test.out",
               "#{LOCAL_EXAMPLE_DIR}/merging/merging_big/merged.out"])
# FileList["#{LOCAL_EXAMPLE_DIR}/dlt/*.out"].each { |f| rm f }

namespace :neon do
  desc 'rebuild neon'
  task :rebuild => :ts_build do
    # sh 'neon build --release'
    sh 'node_modules/.bin/electron-build-env node_modules/.bin/neon build --release'
  end

  desc 'test all but super huge'
  task :all

  desc 'test neon integration: dlt non-verbose indexing'
  task dlt_nonverbose: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync', "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog.dlt",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog.out",
                       50_000,
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog.xml")
  end
  task all: 'neon:dlt_nonverbose'

  desc 'test neon integration: dlt pcap indexing'
  task dlt_pcap: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testIndexingPcap', "#{LOCAL_EXAMPLE_DIR}/dlt/test.pcapng",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/test.pcapng.out")
  end
  task all: 'neon:dlt_nonverbose'

  desc 'test neon integration: broken simple.xml'
  task dlt_nonverbose_broken: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync', "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog3.dlt",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog3.out",
                       50_000,
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/simple.xml")
  end
  task all: 'neon:dlt_nonverbose_broken'

  desc 'test neon integration: small dlt non-verbose indexing'
  task dlt_small_nonverbose: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync', "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/simple.dlt",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/simple.out",
                       800,
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/simple.xml")
  end
  task all: 'neon:dlt_small_nonverbose'

  desc 'cancel dlt processing'
  task dlt_cancelled_nonverbose: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testCancelledAsyncDltIndexing', "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/simple.dlt",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog.out",
                       50_000,
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog.xml")
  end
  task all: 'neon:dlt_cancelled_nonverbose'

  desc 'test neon integration: dlt indexing'
  task dlt: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync', './tests/testfile.dlt', './out/testfile.out', 5000)
  end
  task all: 'neon:dlt'

  desc 'test neon integration: discover timestamps'
  task discover: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function_with_array(
      'testDiscoverTimespanAsync',
      ['./tests/mini_with_invalids.log',
       "#{LOCAL_EXAMPLE_DIR}/indexing/access_huge.log",
       "#{LOCAL_EXAMPLE_DIR}/concat/2019-07-15_06.26.01.log"]
    )
  end
  task all: 'neon:discover'

  desc 'test neon integration: dlt stats'
  task dlt_stats: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testCallDltStats', "#{LOCAL_EXAMPLE_DIR}/dlt/morten_3.dlt")
  end
  task all: 'neon:dlt_stats'

  desc 'test neon integration: dlt over socket'
  task dlt_socket: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testSocketDlt', "#{LOCAL_EXAMPLE_DIR}/dlt/socket_upd.out")
  end
  task all: 'neon:dlt_socket'

  desc 'test neon integration: concat'
  task concat: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testCallConcatFiles',
      "#{LOCAL_EXAMPLE_DIR}/concat/concat.json.conf",
      "#{LOCAL_EXAMPLE_DIR}/concat/concatenated.out"
    )
  end
  task all: 'neon:concat'

  desc 'test neon integration: merge'
  task merge: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testCallMergeFiles',
      "#{LOCAL_EXAMPLE_DIR}/merging/merging_big/config.json",
      "#{LOCAL_EXAMPLE_DIR}/merging/merging_big/merged.out"
    )
  end
  task all: 'neon:merge'

  task index: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testIndexingAsync',
      "#{LOCAL_EXAMPLE_DIR}/indexing/access_huge.log",
      "#{LOCAL_EXAMPLE_DIR}/indexing/test.out"
    )
  end
  task all: 'neon:index'

  desc 'test neon integration: regular indexing'
  desc 'test neon integration: short indexing'
  task index_short: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testIndexingAsync',
      "#{LOCAL_EXAMPLE_DIR}/indexing/access_tiny.log",
      "#{LOCAL_EXAMPLE_DIR}/indexing/test.out"
    )
  end
  task all: 'neon:index_short'

  desc 'test neon integration for a problematic file'
  task problem: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync',
                      "#{LOCAL_EXAMPLE_DIR}/dlt/morton_problem_file.dlt",
                      "#{LOCAL_EXAMPLE_DIR}/dlt/morton_problem_file.dlt.out",
                      5000)
  end
  task all: 'neon:problem'

  desc 'test neon integration for a problematic file2'
  task problem2: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync',
                      "#{LOCAL_EXAMPLE_DIR}/dlt/morten_3.dlt",
                      "#{LOCAL_EXAMPLE_DIR}/dlt/morten_3.dlt.out",
                      5000)
  end
  task all: 'neon:problem'

  desc 'test neon integration stats for a huge file'
  task stats: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testCallDltStats',
                      "#{LOCAL_EXAMPLE_DIR}/dlt/huge.dlt")
  end
  task all: 'neon:stats'

  desc 'test neon cancel task'
  task cancelled: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testCancelledAsyncIndexing',
                      "#{LOCAL_EXAMPLE_DIR}/indexing/access_huge.log",
                      "#{LOCAL_EXAMPLE_DIR}/indexing/test.out")
  end
  task all: 'neon:cancelled'
end


def exec_node_expression(node_exp)
  puts "executing rust function: #{node_exp}"
  system({ 'ELECTRON_RUN_AS_NODE' => 'true' }, "./node_modules/.bin/electron -e '#{node_exp}'")
end

def call_test_function(function_name, *args)
  func_args = args.map { |a| "\"#{a}\"" }.join(',')
  node_exp = "#{TESTS_JS_REQUIRE}.#{function_name}(#{func_args})"
  exec_node_expression(node_exp)
end

def call_test_function_with_array(function_name, list, *args)
  func_args = args.map { |a| "\"#{a}\"" }.join(',')
  node_exp = if func_args.empty?
               "#{TESTS_JS_REQUIRE}.#{function_name}(#{list})"
             else
               "#{TESTS_JS_REQUIRE}.#{function_name}(#{func_args}, #{list})"
             end
  exec_node_expression(node_exp)
end

desc 'watch and rebuid ts files'
task :ts_watch do
  sh 'tsc -p ./tsconfig.json -w'
end
desc 'rebuid ts files'
task :ts_build do
  sh 'tsc -p ./tsconfig.json'
end
